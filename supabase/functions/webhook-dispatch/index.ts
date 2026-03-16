import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_RETRIES = 3;
const RETRY_DELAYS = [0, 10_000, 60_000];
const TIMEOUT_MS = 30_000;

interface WebhookPayload {
  event: string;
  timestamp: string;
  message: {
    id: string;
    conversation_id: string;
    sender_id: string;
    sender_name: string;
    sender_is_agent: boolean;
    content: string;
    content_type: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
  };
  conversation: {
    id: string;
    type: string;
    name: string | null;
    member_count: number;
  };
  agent: {
    id: string;
    webhook_config_id: string;
  };
}

interface AgentConfigRow {
  id: string;
  webhook_url: string;
  webhook_secret: string | null;
  is_webhook_active: boolean;
}

async function computeHmacSignature(
  secret: string,
  webhookId: string,
  timestamp: number,
  payload: string,
): Promise<string> {
  const signatureInput = `${webhookId}.${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signatureInput),
  );
  const hexSignature = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256=${hexSignature}`;
}

function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return false;
    if (hostname.endsWith(".local") || hostname.endsWith(".internal")) return false;
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

async function dispatchToAgent(
  supabase: ReturnType<typeof createClient>,
  webhookPayload: WebhookPayload,
  config: AgentConfigRow,
): Promise<void> {
  if (!isValidWebhookUrl(config.webhook_url)) {
    await supabase
      .from("webhook_delivery_logs")
      .insert({
        message_id: webhookPayload.message.id,
        agent_id: webhookPayload.agent.id,
        status: "failed",
        attempt_count: 0,
        last_error: "Invalid webhook URL: must be HTTPS and not a private/local address",
      });
    return;
  }
  const { data: logEntry } = await supabase
    .from("webhook_delivery_logs")
    .insert({
      message_id: webhookPayload.message.id,
      agent_id: webhookPayload.agent.id,
      status: "pending",
      attempt_count: 0,
    })
    .select("id")
    .single();

  if (!logEntry) return;

  const logId = logEntry.id;
  const payloadString = JSON.stringify(webhookPayload);
  const timestamp = Math.floor(Date.now() / 1000);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Webhook-ID": logId,
    "X-Webhook-Timestamp": String(timestamp),
    "User-Agent": "AgentPlayground-Webhook/1.0",
  };

  if (config.webhook_secret) {
    headers["X-Webhook-Signature"] = await computeHmacSignature(
      config.webhook_secret,
      logId,
      timestamp,
      payloadString,
    );
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt]));
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(config.webhook_url, {
        method: "POST",
        headers,
        body: payloadString,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const isSuccess = response.ok;
      const isClientError = response.status >= 400 && response.status < 500;

      await supabase
        .from("webhook_delivery_logs")
        .update({
          attempt_count: attempt + 1,
          http_status: response.status,
          status: isSuccess ? "delivered" : isClientError ? "failed" : "pending",
          delivered_at: isSuccess ? new Date().toISOString() : null,
          last_error: isSuccess ? null : `${response.status} ${response.statusText}`,
        })
        .eq("id", logId);

      if (isSuccess || isClientError) break;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Connection failed";
      const isLastAttempt = attempt + 1 >= MAX_RETRIES;

      await supabase
        .from("webhook_delivery_logs")
        .update({
          attempt_count: attempt + 1,
          status: isLastAttempt ? "failed" : "pending",
          last_error: errorMessage,
        })
        .eq("id", logId);

      if (isLastAttempt) break;
    }
  }
}

Deno.serve(async (request) => {
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { type?: string; record?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const record = body.record;
  if (!record) {
    return new Response("No record in payload", { status: 400 });
  }

  const messageId = record.id as string;
  const conversationId = record.conversation_id as string;
  const senderId = record.sender_id as string;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: sender } = await supabase
    .from("users")
    .select("id, display_name, is_agent")
    .eq("id", senderId)
    .single();

  if (!sender || sender.is_agent) {
    return new Response("Skipped: agent sender or sender not found", { status: 200 });
  }

  const { data: message } = await supabase
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .single();

  if (!message) {
    return new Response("Message not found", { status: 404 });
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, type, name")
    .eq("id", conversationId)
    .single();

  if (!conversation) {
    return new Response("Conversation not found", { status: 404 });
  }

  const { count: memberCount } = await supabase
    .from("conversation_members")
    .select("*", { count: "exact", head: true })
    .eq("conversation_id", conversationId);

  const { data: agentMembers } = await supabase
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .neq("user_id", senderId);

  if (!agentMembers || agentMembers.length === 0) {
    return new Response("No other members", { status: 200 });
  }

  const agentUserIds = agentMembers.map((member) => member.user_id);

  const { data: agentConfigs } = await supabase
    .from("agent_configs")
    .select("id, user_id, webhook_url, webhook_secret, is_webhook_active")
    .in("user_id", agentUserIds)
    .eq("is_webhook_active", true);

  if (!agentConfigs || agentConfigs.length === 0) {
    return new Response("No active agent webhooks", { status: 200 });
  }

  const dispatchPromises = agentConfigs.map((config) => {
    const webhookPayload: WebhookPayload = {
      event: "message.created",
      timestamp: new Date().toISOString(),
      message: {
        id: message.id,
        conversation_id: message.conversation_id,
        sender_id: sender.id,
        sender_name: sender.display_name,
        sender_is_agent: sender.is_agent,
        content: message.content,
        content_type: message.content_type,
        metadata: message.metadata,
        created_at: message.created_at,
      },
      conversation: {
        id: conversation.id,
        type: conversation.type,
        name: conversation.name,
        member_count: memberCount || 0,
      },
      agent: {
        id: config.user_id,
        webhook_config_id: config.id,
      },
    };

    return dispatchToAgent(supabase, webhookPayload, config);
  });

  await Promise.allSettled(dispatchPromises);

  return new Response(
    JSON.stringify({ dispatched: agentConfigs.length }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
