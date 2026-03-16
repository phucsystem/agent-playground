# Phase 2: Webhook Dispatch Edge Function

## Context

- [API_SPEC.md](../../docs/API_SPEC.md) — Webhook dispatch section (payload, headers, retry policy)
- [SRD.md](../../docs/SRD.md) — FR-23, FR-24, FR-27

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** 3h
- **Depends on:** Phase 1 (tables must exist)

Supabase Edge Function that listens for `webhook_dispatch` pg_notify events and fires HTTP POSTs to agent webhook URLs.

## Key Insights

- Supabase Database Webhooks can trigger Edge Functions on table events. Alternative: use `pg_net` extension for HTTP calls directly from PL/pgSQL. Edge Function chosen for retry logic + logging.
- pg_notify has 8KB payload limit — only pass IDs, fetch full data in Edge Function.

## Architecture

```
pg_notify('webhook_dispatch', {message_id, conversation_id, sender_id})
    ↓
Supabase Database Webhook (configured in dashboard or config.toml)
    ↓
Edge Function: webhook-dispatch
    ↓
1. Fetch message details (content, sender info)
2. Fetch conversation details (type, name, member_count)
3. Query agent_configs for active agents in conversation
4. For each agent:
   a. Create webhook_delivery_logs entry (status: pending)
   b. Build payload (see API_SPEC.md)
   c. Compute HMAC-SHA256 if secret exists
   d. POST to webhook_url with headers
   e. Handle response:
      - 2xx → update log (delivered)
      - 4xx → update log (failed, no retry)
      - 5xx/timeout → retry per policy
   f. Update log with final status
```

## Related Code Files

**Create:**
- `/Users/phuc/Code/04-llms/agent-labs/supabase/functions/webhook-dispatch/index.ts`

**Modify:**
- `/Users/phuc/Code/04-llms/agent-labs/supabase/config.toml` — Register Database Webhook (if using config approach)

## Implementation Steps

1. Create Edge Function `supabase/functions/webhook-dispatch/index.ts`:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [0, 10_000, 60_000]; // immediate, 10s, 60s
const TIMEOUT_MS = 30_000;

Deno.serve(async (request) => {
  // Verify request is from Supabase (check authorization header)
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await request.json();
  const { record } = payload; // Database webhook sends the new row
  const messageId = record.id;
  const conversationId = record.conversation_id;
  const senderId = record.sender_id;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. Check sender is not an agent (double-check, trigger should skip)
  const { data: sender } = await supabase
    .from("users")
    .select("id, display_name, is_agent")
    .eq("id", senderId)
    .single();

  if (sender?.is_agent) {
    return new Response("Skipped: agent sender", { status: 200 });
  }

  // 2. Fetch message
  const { data: message } = await supabase
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .single();

  // 3. Fetch conversation
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, type, name")
    .eq("id", conversationId)
    .single();

  const { count: memberCount } = await supabase
    .from("conversation_members")
    .select("*", { count: "exact", head: true })
    .eq("conversation_id", conversationId);

  // 4. Get active agent configs for this conversation
  const { data: agentConfigs } = await supabase
    .from("conversation_members")
    .select("user_id, agent_configs!inner(id, webhook_url, webhook_secret, is_webhook_active)")
    .eq("conversation_id", conversationId)
    .neq("user_id", senderId);

  const activeAgents = (agentConfigs || []).filter(
    (member) => member.agent_configs?.is_webhook_active
  );

  // 5. Dispatch to each agent
  for (const agentMember of activeAgents) {
    const config = agentMember.agent_configs;
    await dispatchWebhook(supabase, {
      messageId, message, sender, conversation,
      memberCount: memberCount || 0,
      agentId: agentMember.user_id,
      config,
    });
  }

  return new Response("OK", { status: 200 });
});
```

2. Implement `dispatchWebhook` function with retry logic:

```typescript
async function dispatchWebhook(supabase, context) {
  const { messageId, message, sender, conversation, memberCount, agentId, config } = context;

  // Create log entry
  const { data: log } = await supabase
    .from("webhook_delivery_logs")
    .insert({
      message_id: messageId,
      agent_id: agentId,
      status: "pending",
      attempt_count: 0,
    })
    .select()
    .single();

  const webhookPayload = {
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
      member_count: memberCount,
    },
    agent: {
      id: agentId,
      webhook_config_id: config.id,
    },
  };

  const payloadString = JSON.stringify(webhookPayload);
  const timestamp = Math.floor(Date.now() / 1000);

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Webhook-ID": log.id,
    "X-Webhook-Timestamp": String(timestamp),
    "User-Agent": "AgentPlayground-Webhook/1.0",
  };

  // HMAC signature if secret exists
  if (config.webhook_secret) {
    const signatureInput = `${log.id}.${timestamp}.${payloadString}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(config.webhook_secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signatureInput));
    const hexSig = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");
    headers["X-Webhook-Signature"] = `sha256=${hexSig}`;
  }

  // Retry loop
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
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

      await supabase
        .from("webhook_delivery_logs")
        .update({
          attempt_count: attempt + 1,
          http_status: response.status,
          status: response.ok ? "delivered" : (response.status < 500 ? "failed" : "pending"),
          delivered_at: response.ok ? new Date().toISOString() : null,
          last_error: response.ok ? null : `${response.status} ${response.statusText}`,
        })
        .eq("id", log.id);

      if (response.ok || response.status < 500) break; // Success or client error = no retry
    } catch (error) {
      await supabase
        .from("webhook_delivery_logs")
        .update({
          attempt_count: attempt + 1,
          status: attempt + 1 >= MAX_RETRIES ? "failed" : "pending",
          last_error: error.message || "Connection failed",
        })
        .eq("id", log.id);

      if (attempt + 1 >= MAX_RETRIES) break;
    }
  }
}
```

3. Configure Database Webhook trigger in Supabase:
   - Go to Dashboard → Database → Webhooks (or `supabase/config.toml`)
   - Table: `messages`, Event: `INSERT`
   - URL: Edge Function URL for `webhook-dispatch`
   - Headers: `Authorization: Bearer {SERVICE_ROLE_KEY}`

**Alternative (config.toml):**
```toml
[db.webhooks.webhook_dispatch]
enabled = true
table = "messages"
events = ["INSERT"]
function = "webhook-dispatch"
```

## Todo

- [x] Create `supabase/functions/webhook-dispatch/index.ts`
- [x] Implement payload construction per API_SPEC
- [x] Implement HMAC-SHA256 signing
- [x] Implement retry logic (3 attempts, exponential backoff)
- [x] Configure Database Webhook in Supabase dashboard
- [x] Test with seed agent (Claude Agent)

## Success Criteria

- Human message in DM with agent → webhook fires within 2s
- Webhook payload matches API_SPEC format
- HMAC signature verifiable by agent
- Failed delivery retries up to 3 times
- 4xx = no retry, 5xx/timeout = retry
- Delivery log created with correct status
- Agent-sent messages do NOT trigger webhook

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Edge Function cold start adds latency | Medium — first call ~500ms | Supabase keeps functions warm after first invocation |
| pg_notify dropped under load | Low — <50 users | Database Webhook is more reliable than pg_notify; consider switching trigger to direct webhook |
| Retry delays block Edge Function | Medium — 60s wait on retry 3 | Use background task or Deno.cron if available; for MVP, synchronous retries acceptable |

## Security

- Edge Function authenticated via `SERVICE_ROLE_KEY` in Authorization header
- Webhook secret never sent in payload — only used for HMAC computation
- HTTPS enforced on webhook URLs via CHECK constraint on agent_configs
