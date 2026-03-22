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

interface GoclawFetchOptions {
  webhookId: string;
  extraHeaders?: Record<string, string>;
}

async function goclawFetch(
  url: string,
  body: Record<string, unknown>,
  options: GoclawFetchOptions,
): Promise<Response> {
  console.log(`[bridge] >>> GoClaw request (webhook ${options.webhookId}) ${url}`, JSON.stringify(body).slice(0, 200));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GOCLAW_TIMEOUT_MS);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GOCLAW_TOKEN}`,
      "Content-Type": "application/json",
      ...options.extraHeaders,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);
  return response;
}

interface ResponseContext {
  goclawAgentKey: string;
  conversationId: string;
  webhookId: string;
  startTime: number;
  endpoint: string;
}

async function handleGoclawResponse(
  goclawResponse: Response,
  context: ResponseContext,
): Promise<NextResponse> {
  const { goclawAgentKey, conversationId, webhookId, startTime, endpoint } = context;

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
  console.log(`[bridge] <<< GoClaw response (webhook ${webhookId}) ${endpoint} status=${goclawResponse.status}`, rawResponseText);

  let responseData: Record<string, unknown>;
  try {
    responseData = JSON.parse(rawResponseText);
  } catch {
    return NextResponse.json({ error: "GoClaw returned invalid response" }, { status: 502 });
  }

  // Extract reply — try all known GoClaw response fields
  let content = (responseData.text as string)
    || (responseData.reply as string)
    || (responseData.content as string)
    || ((responseData.payload as Record<string, unknown>)?.content as string)
    || ((responseData.choices as Array<{ message?: { content?: string } }>)?.[0]?.message?.content);

  if (!content) {
    console.error(`[bridge] No content in GoClaw response (webhook ${webhookId})`, rawResponseText);
    return NextResponse.json({ error: "GoClaw returned empty response" }, { status: 502 });
  }

  const latencyMs = Date.now() - startTime;
  console.log(`[bridge] GoClaw call completed`, {
    agentKey: goclawAgentKey,
    conversationId,
    webhookId,
    endpoint,
    latencyMs,
    replyLength: content.length,
  });

  return NextResponse.json({ reply: content });
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

  // Derive sender_id from history (last non-agent sender) for X-GoClaw-User-Id
  const senderId = (history || [])
    .filter((item) => !item.is_agent)
    .map((item) => item.sender_id)
    .pop() || "unknown";

  const startTime = Date.now();

  try {
    // Primary: /api/chat/messages (GoClaw manages history server-side)
    const primaryResponse = await goclawFetch(
      `${GOCLAW_URL}/api/chat/messages`,
      { conversationId, agentId: goclawAgentKey, text: message.content },
      { webhookId },
    );

    // Fallback: /v1/chat/completions when primary returns 405
    if (primaryResponse.status === 405) {
      console.warn(`[bridge] /api/chat/messages returned 405, falling back to /v1/chat/completions (webhook ${webhookId})`);
      const fallbackResponse = await goclawFetch(
        `${GOCLAW_URL}/v1/chat/completions`,
        {
          model: `goclaw:${goclawAgentKey}`,
          messages: [{ role: "user", content: message.content }],
        },
        { webhookId, extraHeaders: { "X-GoClaw-User-Id": senderId } },
      );
      return handleGoclawResponse(fallbackResponse, { goclawAgentKey, conversationId, webhookId, startTime, endpoint: "/v1/chat/completions" });
    }

    return handleGoclawResponse(primaryResponse, { goclawAgentKey, conversationId, webhookId, startTime, endpoint: "/api/chat/messages" });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error(`[bridge] GoClaw timeout after ${GOCLAW_TIMEOUT_MS}ms (webhook ${webhookId})`);
      return NextResponse.json({ error: "GoClaw timeout" }, { status: 504 });
    }
    console.error(`[bridge] GoClaw request failed (webhook ${webhookId}):`, error);
    return NextResponse.json({ error: "GoClaw request failed" }, { status: 502 });
  }
}
