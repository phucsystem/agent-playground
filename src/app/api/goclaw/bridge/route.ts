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

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface HistoryItem {
  sender_id: string;
  is_agent: boolean;
  content_type: string;
}

interface BridgeRequestBody {
  message: { content: string };
  sender: string;
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
    const { data: configs, error: configQueryError } = await supabaseAdmin
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
    const { data: allConfigs, error: fallbackError } = await supabaseAdmin
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

  const metadata = (matchedAgent.metadata || {}) as Record<string, unknown>;
  const goclawAgentKey = metadata.goclaw_agent_key as string | undefined;

  if (!goclawAgentKey) {
    return NextResponse.json({ error: "No GoClaw agent key configured" }, { status: 400 });
  }

  // GoClaw /api/chat/messages contract:
  // - conversationId: ties requests to the same session (GoClaw manages history)
  // - agentId: the GoClaw agent key
  // - text: current message only
  const goclawBody = {
    conversationId,
    agentId: goclawAgentKey,
    text: message.content,
  };

  const startTime = Date.now();

  console.log(`[bridge] >>> GoClaw request (webhook ${webhookId})`, {
    conversationId,
    agentId: goclawAgentKey,
    text: message.content.slice(0, 100),
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GOCLAW_TIMEOUT_MS);

    const goclawResponse = await fetch(`${GOCLAW_URL}/api/chat/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GOCLAW_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(goclawBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (goclawResponse.status === 401) {
      return NextResponse.json({ error: "GoClaw authentication failed" }, { status: 502 });
    }

    if (goclawResponse.status === 429) {
      const retryAfter = goclawResponse.headers.get("retry-after");
      const responseHeaders: Record<string, string> = {};
      if (retryAfter) responseHeaders["retry-after"] = retryAfter;
      return NextResponse.json({ error: "GoClaw rate limited" }, { status: 429, headers: responseHeaders });
    }

    if (!goclawResponse.ok) {
      return NextResponse.json(
        { error: `GoClaw error: ${goclawResponse.status}` },
        { status: 502 },
      );
    }

    const rawResponseText = await goclawResponse.text();
    console.log(`[bridge] <<< GoClaw response (webhook ${webhookId}) status=${goclawResponse.status}`, rawResponseText);

    let responseData: Record<string, unknown>;
    try {
      responseData = JSON.parse(rawResponseText);
    } catch {
      return NextResponse.json({ error: "GoClaw returned invalid response" }, { status: 502 });
    }

    // Extract reply — pin to confirmed GoClaw response field, fallback with warning
    let content = responseData.text as string | undefined;
    if (!content) {
      const fallback =
        (responseData.reply as string) ||
        (responseData.content as string) ||
        ((responseData.payload as Record<string, unknown>)?.content as string);
      if (fallback) {
        console.warn(`[bridge] GoClaw response used fallback field instead of 'text' (webhook ${webhookId})`);
        content = fallback;
      }
    }

    if (!content) {
      console.error(`[bridge] No content in GoClaw response (webhook ${webhookId})`, rawResponseText);
      return NextResponse.json({ error: "GoClaw returned empty response" }, { status: 502 });
    }

    const latencyMs = Date.now() - startTime;
    console.log(`[bridge] GoClaw call completed`, {
      agentKey: goclawAgentKey,
      conversationId,
      webhookId,
      latencyMs,
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
