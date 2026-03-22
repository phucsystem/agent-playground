import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

const GOCLAW_URL = process.env.GOCLAW_URL;
const GOCLAW_TOKEN = process.env.GOCLAW_GATEWAY_TOKEN;
const GOCLAW_TIMEOUT_MS = 25_000;

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

interface HistoryItem {
  sender_id: string;
  sender_name: string;
  is_agent: boolean;
  content: string;
  content_type: string;
}

interface BridgeRequestBody {
  message: { content: string };
  sender: string;
  conversation_id: string;
  message_id: string;
  history: HistoryItem[];
}

interface GoClawResponse {
  type: string;
  ok: boolean;
  payload?: {
    runId?: string;
    content?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  choices?: { message?: { content?: string } }[];
}

interface MatchedAgentConfig {
  user_id: string;
  metadata: Record<string, unknown> | null;
}

function buildSystemPrompt(
  conversationType: string,
  conversationName: string | null,
  senderName: string,
  memberNames: string[],
): string {
  if (conversationType === "dm") {
    return `You are in a direct message conversation with ${senderName}.`;
  }
  const nameList = memberNames.slice(0, 5).join(", ");
  const suffix = memberNames.length > 5 ? ` and ${memberNames.length - 5} more` : "";
  return `You are in a group conversation '${conversationName || "Unnamed"}' with ${memberNames.length} members: ${nameList}${suffix}.`;
}

function mapHistoryToMessages(
  history: HistoryItem[],
  isGroup: boolean,
): { role: string; content: string }[] {
  return history
    .filter((item) => item.content_type === "text")
    .map((item) => {
      const role = item.is_agent ? "assistant" : "user";
      const content = isGroup && !item.is_agent
        ? `${item.sender_name}: ${item.content}`
        : item.content;
      return { role, content };
    });
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

  const { message, sender, conversation_id: conversationId, message_id: messageId, history } = body;
  if (!message?.content || !conversationId || !messageId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const senderName = sender || "Unknown";

  // Extract sender_id from history (last non-agent sender, which is the current message author)
  const senderId = (history || [])
    .filter((item) => !item.is_agent)
    .at(-1)?.sender_id || "unknown";

  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearerToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webhookId = request.headers.get("x-webhook-id") || "unknown";
  const supabase = getSupabaseAdmin();

  // Collect agent IDs from history for targeted lookup
  const agentUserIds = new Set<string>();
  for (const item of history || []) {
    if (item.is_agent) agentUserIds.add(item.sender_id);
  }

  let matchedAgent: MatchedAgentConfig | null = null;

  // Try targeted lookup first (agents from history)
  const agentIdCandidates = Array.from(agentUserIds);
  if (agentIdCandidates.length > 0) {
    const { data: configs, error: configQueryError } = await supabase
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

  // Fallback: query by secret directly
  if (!matchedAgent) {
    const { data: allConfigs, error: fallbackError } = await supabase
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

  const agentId = matchedAgent.user_id;
  const metadata = (matchedAgent.metadata || {}) as Record<string, unknown>;
  const goclawAgentKey = metadata.goclaw_agent_key as string | undefined;

  if (!goclawAgentKey) {
    return NextResponse.json({ error: "No GoClaw agent key configured" }, { status: 400 });
  }

  // Get conversation details for system prompt
  const { data: conversation } = await supabase
    .from("conversations")
    .select("type, name")
    .eq("id", conversationId)
    .single();

  const conversationType = conversation?.type || "dm";
  const conversationName = conversation?.name || null;

  // Get member names for group context
  let memberNames: string[] = [];
  if (conversationType === "group") {
    const { data: members } = await supabase
      .from("conversation_members")
      .select("users!inner(display_name)")
      .eq("conversation_id", conversationId);

    if (members) {
      memberNames = members.map(
        (member: { users: { display_name: string }[] }) => {
          const userRecord = member.users[0];
          return userRecord?.display_name || "Unknown";
        },
      );
    }
  }

  const systemPrompt = buildSystemPrompt(conversationType, conversationName, senderName, memberNames);
  const isGroup = conversationType === "group";

  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...mapHistoryToMessages(history || [], isGroup),
    {
      role: "user",
      content: isGroup ? `${senderName}: ${message.content}` : message.content,
    },
  ];

  const startTime = Date.now();

  const goclawHeaders = {
    "Authorization": `Bearer ${GOCLAW_TOKEN}`,
    "X-GoClaw-User-Id": senderId,
    "X-GoClaw-Conversation-Id": conversationId,
    "Content-Type": "application/json",
  };

  const goclawBody = {
    model: `goclaw:${goclawAgentKey}`,
    messages,
  };

  console.log(`[bridge] >>> GoClaw request (webhook ${webhookId})`, {
    url: `${GOCLAW_URL}/v1/chat/completions`,
    headers: { ...goclawHeaders, Authorization: "Bearer ***" },
    body: JSON.stringify(goclawBody),
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GOCLAW_TIMEOUT_MS);

    const goclawResponse = await fetch(`${GOCLAW_URL}/v1/chat/completions`, {
      method: "POST",
      headers: goclawHeaders,
      body: JSON.stringify(goclawBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (goclawResponse.status === 401) {
      return NextResponse.json({ error: "GoClaw authentication failed" }, { status: 502 });
    }

    if (goclawResponse.status === 429) {
      const retryAfter = goclawResponse.headers.get("retry-after");
      const headers: Record<string, string> = {};
      if (retryAfter) headers["retry-after"] = retryAfter;
      return NextResponse.json({ error: "GoClaw rate limited" }, { status: 429, headers });
    }

    if (goclawResponse.status >= 500) {
      return NextResponse.json(
        { error: `GoClaw error: ${goclawResponse.status}` },
        { status: 502 },
      );
    }

    if (!goclawResponse.ok) {
      return NextResponse.json(
        { error: `GoClaw error: ${goclawResponse.status}` },
        { status: 502 },
      );
    }

    let responseData: GoClawResponse;
    try {
      responseData = await goclawResponse.json();
    } catch {
      return NextResponse.json({ error: "GoClaw returned invalid response" }, { status: 502 });
    }

    if (responseData.ok === false) {
      const errorMsg = (responseData.payload as Record<string, unknown>)?.error || "Unknown error";
      return NextResponse.json({ error: `GoClaw error: ${errorMsg}` }, { status: 502 });
    }

    // Extract content — prefer payload.content, fallback to choices[0]
    let content = responseData.payload?.content;
    if (!content && responseData.choices?.[0]?.message?.content) {
      content = responseData.choices[0].message.content;
    }

    if (!content) {
      return NextResponse.json({ error: "GoClaw returned empty response" }, { status: 502 });
    }

    const latencyMs = Date.now() - startTime;
    console.log(`[bridge] GoClaw call completed`, {
      agentKey: goclawAgentKey,
      conversationId,
      webhookId,
      latencyMs,
      inputTokens: responseData.payload?.usage?.input_tokens,
      outputTokens: responseData.payload?.usage?.output_tokens,
      replyLength: content.length,
    });

    return NextResponse.json({ reply: content });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error(`[bridge] GoClaw timeout after ${GOCLAW_TIMEOUT_MS}ms (webhook ${webhookId})`);
      return NextResponse.json({ error: "GoClaw timeout" }, { status: 504 });
    }
    console.error(`[bridge] GoClaw request failed (webhook ${webhookId}):`, error);
    return NextResponse.json({ error: "GoClaw request failed" }, { status: 502 });
  }
}
