import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getGoclawClient } from "@/lib/goclaw";

const GOCLAW_URL = process.env.GOCLAW_URL;
const GOCLAW_TOKEN = process.env.GOCLAW_GATEWAY_TOKEN;

const BLOCKED_HOSTNAMES = ["localhost", "127.0.0.1", "::1", "[::1]", "metadata.google.internal"];
const BLOCKED_IP_PREFIXES = ["10.", "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.", "192.168.", "169.254."];

if (!GOCLAW_URL || !GOCLAW_TOKEN) {
  console.error("[bridge] FATAL: GOCLAW_URL or GOCLAW_GATEWAY_TOKEN not set");
}

function isBlockedUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    const hostname = parsed.hostname;
    if (BLOCKED_HOSTNAMES.includes(hostname)) return true;
    if (hostname.endsWith(".local") || hostname.endsWith(".internal")) return true;
    for (const prefix of BLOCKED_IP_PREFIXES) {
      if (hostname.startsWith(prefix)) return true;
    }
    return false;
  } catch {
    return true;
  }
}

function safeCompare(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const CHUNK_UPDATE_DEBOUNCE_MS = 200;

interface HistoryItem {
  sender_id: string;
  is_agent: boolean;
}

interface BridgeRequestBody {
  message: { content: string };
  conversation_id: string;
  message_id: string;
  history: HistoryItem[];
}

interface MatchedAgentConfig {
  user_id: string;
  metadata: Record<string, unknown> | null;
}

export async function POST(request: NextRequest) {
  if (!GOCLAW_URL || !GOCLAW_TOKEN) {
    return NextResponse.json({ error: "GoClaw not configured" }, { status: 500 });
  }

  if (isBlockedUrl(GOCLAW_URL)) {
    console.error("[bridge] GOCLAW_URL points to a blocked/internal address");
    return NextResponse.json({ error: "GoClaw not configured" }, { status: 500 });
  }

  let body: BridgeRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { message, conversation_id: conversationId, message_id: messageId, history } = body;
  if (!message?.content || !conversationId || !messageId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearerToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webhookId = request.headers.get("x-webhook-id") || "unknown";

  // Find agent config matching the webhook secret
  const agentUserIds = new Set<string>();
  for (const item of history || []) {
    if (item.is_agent) agentUserIds.add(item.sender_id);
  }

  let matchedAgent: MatchedAgentConfig | null = null;

  const agentIdCandidates = Array.from(agentUserIds);
  if (agentIdCandidates.length > 0) {
    const { data: configs, error: configQueryError } = await getSupabaseAdmin()
      .from("agent_configs")
      .select("user_id, webhook_secret, metadata")
      .in("user_id", agentIdCandidates)
      .eq("is_webhook_active", true);

    if (configQueryError) {
      console.error(`[bridge] DB error (webhook ${webhookId}):`, configQueryError.message);
      return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    }

    const matched = configs?.find(
      (config) => config.webhook_secret && safeCompare(bearerToken, config.webhook_secret),
    );
    if (matched) {
      matchedAgent = { user_id: matched.user_id, metadata: matched.metadata };
    }
  }

  if (!matchedAgent) {
    const { data: allConfigs, error: fallbackError } = await getSupabaseAdmin()
      .from("agent_configs")
      .select("user_id, webhook_secret, metadata")
      .eq("webhook_secret", bearerToken)
      .eq("is_webhook_active", true)
      .limit(1);

    if (fallbackError) {
      console.error(`[bridge] DB error (webhook ${webhookId}):`, fallbackError.message);
      return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
    }

    if (allConfigs && allConfigs.length > 0) {
      matchedAgent = { user_id: allConfigs[0].user_id, metadata: allConfigs[0].metadata };
    }
  }

  if (!matchedAgent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentMetadata = (matchedAgent.metadata || {}) as Record<string, unknown>;
  const goclawAgentKey = agentMetadata.goclaw_agent_key as string | undefined;

  if (!goclawAgentKey) {
    return NextResponse.json({ error: "No GoClaw agent key configured" }, { status: 400 });
  }

  const startTime = Date.now();

  // INSERT placeholder streaming message
  const { data: streamingMsg, error: insertError } = await getSupabaseAdmin()
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: matchedAgent.user_id,
      content: "",
      content_type: "text",
      metadata: { streaming_status: "streaming" },
    })
    .select("id")
    .single();

  if (insertError) {
    console.error(`[bridge] Failed to insert streaming message:`, insertError.message);
    return NextResponse.json({ error: "Failed to create message" }, { status: 500 });
  }

  const streamingMessageId = streamingMsg.id;
  let accumulatedContent = "";
  let lastUpdateTime = 0;
  let streamCompleted = false;
  const eventCleanups: (() => void)[] = [];

  try {
    const goclawClient = getGoclawClient();

    console.log(`[bridge] >>> GoClaw WS chat.send (webhook ${webhookId})`, {
      agentId: goclawAgentKey,
      conversationId,
      textLength: message.content.length,
    });

    // Subscribe to lifecycle events for progressive streaming UI
    let lastStatusUpdateTime = 0;
    const STATUS_DEBOUNCE_MS = 500;

    const updateAgentStatus = (agentStatusText: string) => {
      if (streamCompleted) return;
      const now = Date.now();
      if (now - lastStatusUpdateTime < STATUS_DEBOUNCE_MS) return;
      lastStatusUpdateTime = now;
      getSupabaseAdmin()
        .from("messages")
        .update({ metadata: { streaming_status: "streaming", agent_status: agentStatusText } })
        .eq("id", streamingMessageId)
        .then(({ error }) => {
          if (error) console.error("[bridge] Failed to update agent status:", error.message);
        });
    };

    // GoClaw streams chunks and lifecycle events as separate event messages
    eventCleanups.push(goclawClient.on("chunk", (data) => {
      const chunkContent = (data.payload as Record<string, unknown>)?.content as string;
      if (!chunkContent || streamCompleted) return;
      accumulatedContent += chunkContent;
      const now = Date.now();
      if (now - lastUpdateTime >= CHUNK_UPDATE_DEBOUNCE_MS) {
        lastUpdateTime = now;
        getSupabaseAdmin()
          .from("messages")
          .update({ content: accumulatedContent })
          .eq("id", streamingMessageId)
          .then(({ error }) => {
            if (error) console.error("[bridge] Failed to update chunk:", error.message);
          });
      }
    }));
    eventCleanups.push(goclawClient.on("run.started", () => {
      updateAgentStatus("Thinking...");
    }));
    eventCleanups.push(goclawClient.on("thinking", () => {
      updateAgentStatus("Thinking...");
    }));
    eventCleanups.push(goclawClient.on("tool.call", (data) => {
      const toolName = (data.payload as Record<string, unknown>)?.name as string || "tool";
      updateAgentStatus(`Calling: ${toolName}`);
    }));
    eventCleanups.push(goclawClient.on("activity", (data) => {
      const iteration = (data.payload as Record<string, unknown>)?.iteration as number;
      if (iteration && iteration > 1) updateAgentStatus(`Processing (step ${iteration})...`);
    }));

    // chat.send returns the full response as a single req/res
    const response = await goclawClient.send(
      "chat.send",
      { agentId: goclawAgentKey, message: message.content },
    ) as Record<string, unknown>;

    const fullContent = (response.content as string) || accumulatedContent || "";

    // Guard: prevent late status updates from overwriting 'complete'
    streamCompleted = true;

    // Clean up event subscriptions
    eventCleanups.forEach((cleanup) => cleanup());

    // Final update with complete content
    await getSupabaseAdmin()
      .from("messages")
      .update({
        content: fullContent,
        metadata: { streaming_status: "complete" },
      })
      .eq("id", streamingMessageId);

    const latencyMs = Date.now() - startTime;
    console.log(`[bridge] GoClaw WS chat.send completed`, {
      agentKey: goclawAgentKey,
      conversationId,
      webhookId,
      endpoint: "chat.send",
      latencyMs,
      replyLength: fullContent.length,
    });

    return NextResponse.json({ reply: fullContent, already_inserted: true });
  } catch (error: unknown) {
    streamCompleted = true;
    eventCleanups.forEach((cleanup) => cleanup());

    // On stream failure: update message to error state
    await getSupabaseAdmin()
      .from("messages")
      .update({
        content: accumulatedContent || "[Agent response failed]",
        metadata: { streaming_status: "error" },
      })
      .eq("id", streamingMessageId);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[bridge] GoClaw WS stream failed (webhook ${webhookId}):`, errorMessage);

    if (errorMessage.includes("timeout")) {
      return NextResponse.json({ error: "GoClaw timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: "GoClaw request failed" }, { status: 502 });
  }
}
