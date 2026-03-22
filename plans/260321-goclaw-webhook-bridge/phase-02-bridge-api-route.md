# Phase 2: Bridge API Route

## Context
- [webhook-dispatch Edge Function](../../supabase/functions/webhook-dispatch/index.ts) — sends payload, expects `{reply: "..."}` response
- [Health check route pattern](../../src/app/api/agents/health/route.ts) — existing API route pattern
- [Research: GoClaw REST API](../../plans/reports/researcher-260320-goclaw-integration.md) — GoClaw endpoint details
- [GoClaw REST API Reference](https://github.com/nextlevelbuilder/goclaw-docs/blob/master/reference/rest-api.md) — official API docs

## Overview
- **Priority:** P1 (core feature)
- **Status:** complete
- **Effort:** 2h (updated from 1.5h — includes CEO review additions)

## Key Insights
- webhook-dispatch sends simplified payload: `{message: {content}, sender, conversation_id, message_id, history[]}`
- webhook-dispatch expects response: `{reply: "..."}` or `{message: "..."}` or `{content: "..."}`
- **CONFIRMED (2026-03-22):** GoClaw accepts: `POST /api/chat/messages` with `{conversationId, agentId, text}` — GoClaw manages session history server-side via `conversationId`
- Required headers: `Authorization: Bearer TOKEN`, `Content-Type: application/json`
- No system prompt or history mapping needed — GoClaw handles conversation context internally

## Requirements

### Functional
- Receive webhook payload from webhook-dispatch
- Look up `goclaw_agent_key` from agent_configs metadata (via service role)
- Build system prompt with conversation context (conversation type, name, member names)
- Map conversation history to OpenAI messages array (text-only, skip images/files)
- Forward to GoClaw's `/v1/chat/completions` with correct auth + user identity headers
- Extract response from `payload.content` (NOT `choices[0].message.content`)
- Log GoClaw call metrics (latency, model, token count — never log secrets)
- Return `{reply: "..."}` response

### Non-Functional
- Timeout: 25s (leave 5s buffer for webhook-dispatch's 30s timeout)
- Auth: Validate incoming webhook secret via Authorization header (required for GoClaw agents)
- Error handling: All 12 error paths rescued with descriptive responses

## Architecture

```
webhook-dispatch
  |
  | POST /api/goclaw/bridge
  | Headers: Authorization: Bearer <webhook_secret>
  |          X-Webhook-ID: <log_id>
  | Body: {message, sender, conversation_id, message_id, history}
  |
  v
Bridge Route
  |
  | 1. Validate auth (webhook_secret required for GoClaw agents)
  | 2. Query agent_configs for goclaw_agent_key via metadata
  | 3. Build system prompt from conversation metadata
  | 4. Map history[] -> OpenAI messages[] (text-only)
  | 5. POST to GOCLAW_URL/v1/chat/completions
  |    Headers: Authorization: Bearer <GOCLAW_GATEWAY_TOKEN>
  |             X-GoClaw-User-Id: <sender_id>
  | 6. Log latency/model/tokens (structured console.log)
  |
  v
GoClaw Server
  |
  | Returns: {type: "res", ok: true, payload: {content, usage}}
  v
Bridge Route
  |
  | Extract payload.content (NOT choices[0].message.content)
  | Return {reply: content}
```

## Related Code Files
- **Create:** `src/app/api/goclaw/bridge/route.ts`
- **Read:** `supabase/functions/webhook-dispatch/index.ts` (payload format reference)
- **Update:** `.env.example` (add GOCLAW_URL, GOCLAW_GATEWAY_TOKEN)

## Implementation Steps

### 1. Create bridge route file + token safeguards
`src/app/api/goclaw/bridge/route.ts`

**Token protection (top of file, module-level):**
```typescript
const GOCLAW_URL = process.env.GOCLAW_URL;
const GOCLAW_TOKEN = process.env.GOCLAW_GATEWAY_TOKEN;

// Validate on cold start — fail loud, not silent
if (!GOCLAW_URL || !GOCLAW_TOKEN) {
  console.error("[bridge] FATAL: GOCLAW_URL or GOCLAW_GATEWAY_TOKEN not set");
}

// Mask secrets in any log output — never log full token
function maskSecret(value: string): string {
  if (!value || value.length <= 8) return "***";
  return value.slice(0, 4) + "..." + value.slice(-4);
}
```

**Rules enforced in all logging:**
- NEVER log `GOCLAW_TOKEN` or `webhook_secret` in any form
- Use `maskSecret()` if token must be referenced in error context
- Strip Authorization header from any logged request/response objects

### 2. Auth validation
- Extract `Authorization: Bearer <secret>` from request headers
- Parse request body to get `agent.id` (the agent's user_id)
- Query `agent_configs` using service role Supabase client (bypasses RLS):
  ```sql
  SELECT metadata, webhook_secret FROM agent_configs WHERE user_id = agent.id
  ```
- Validate: webhook_secret must exist AND match the Bearer token
- If no webhook_secret configured: reject with 400 "GoClaw agents require webhook_secret"

### 3. System prompt construction
Build a system message from conversation metadata:
- DM: `"You are in a direct message conversation with {sender_name}."`
- Group: `"You are in a group conversation '{conv_name}' with {member_count} members: {first 5 names}..."`
- Include as first message with `role: "system"`

### 4. Payload mapping logic

**Filter:** Only include history items where `content_type === "text"`

**Incoming history item (text only):**
```json
{
  "sender_id": "uuid",
  "sender_name": "Alice",
  "is_agent": false,
  "content": "Hello",
  "content_type": "text"
}
```

**Mapped to OpenAI message:**
```json
{
  "role": "user",       // is_agent=false -> "user", is_agent=true -> "assistant"
  "content": "Hello"    // prefix with sender_name for multi-user context
}
```

For group conversations with multiple humans, prefix content with sender name:
- `"user"` role: `"Alice: Hello"`
- `"assistant"` role: content as-is (agent responses don't need name prefix)

### 5. Add current message to messages array
After mapping history, append the current message as the final user message.

### 6. GoClaw request format
```json
{
  "model": "goclaw:<agent_key>",
  "messages": [
    {"role": "system", "content": "You are in a group conversation..."},
    {"role": "user", "content": "Alice: earlier message"},
    {"role": "assistant", "content": "agent response"},
    {"role": "user", "content": "Bob: current message"}
  ]
}
```

**Headers to GoClaw:**
```
Authorization: Bearer <GOCLAW_GATEWAY_TOKEN>
X-GoClaw-User-Id: <sender_id from webhook payload>
Content-Type: application/json
```

### 7. Response extraction (CORRECTED)
GoClaw returns:
```json
{
  "type": "res",
  "ok": true,
  "payload": {
    "runId": "uuid",
    "content": "Agent's response text",
    "usage": { "input_tokens": 150, "output_tokens": 25 }
  }
}
```

Extract: `response.payload.content`
Return to webhook-dispatch: `{reply: response.payload.content}`

### 8. Structured logging (CEO expansion)
```typescript
console.log(`[bridge] GoClaw call completed`, {
  agentKey,
  conversationId,
  latencyMs: Date.now() - startTime,
  inputTokens: response.payload?.usage?.input_tokens,
  outputTokens: response.payload?.usage?.output_tokens,
  replyLength: content?.length,
});
```
**NEVER log:** GOCLAW_GATEWAY_TOKEN, webhook_secret, full message content

### 9. Error handling (complete — 12 paths)
| Condition | Status | Response |
|-----------|--------|----------|
| Invalid JSON body | 400 | `{error: "Invalid request body"}` |
| Missing required fields | 400 | `{error: "Missing field: X"}` |
| Missing/wrong auth | 401 | `{error: "Unauthorized"}` |
| No webhook_secret configured | 400 | `{error: "GoClaw agents require webhook_secret"}` |
| Supabase connection fail | 500 | `{error: "Database unavailable"}` |
| Agent config not found | 404 | `{error: "Agent config not found"}` |
| No goclaw_agent_key | 400 | `{error: "No GoClaw agent key configured"}` |
| Missing GOCLAW_URL/TOKEN env | 500 | `{error: "GoClaw not configured"}` |
| GoClaw timeout (25s) | 504 | `{error: "GoClaw timeout"}` |
| GoClaw auth rejected (401) | 502 | `{error: "GoClaw authentication failed"}` |
| GoClaw rate limited (429) | 429 | `{error: "GoClaw rate limited"}` + forward retry-after |
| GoClaw server error (5xx) | 502 | `{error: "GoClaw error: {status}"}` |
| GoClaw malformed JSON | 502 | `{error: "GoClaw returned invalid response"}` |
| GoClaw ok=false | 502 | `{error: "GoClaw error: {payload error}"}` |
| Empty payload.content | 502 | `{error: "GoClaw returned empty response"}` |

### 10. Update .env.example
```env
# GoClaw integration (for AI agent bridge)
GOCLAW_URL=https://your-goclaw-server.com
GOCLAW_GATEWAY_TOKEN=your-gateway-token
```

## Todo
- [x] Create `src/app/api/goclaw/bridge/route.ts`
- [x] Implement auth validation (webhook_secret required)
- [x] Implement system prompt construction
- [x] Implement payload mapping (history -> OpenAI messages, text-only)
- [x] Implement GoClaw API call with correct headers (incl. X-GoClaw-User-Id)
- [x] Implement response extraction from `payload.content` (NOT choices[0])
- [x] Implement structured logging (latency, tokens — no secrets)
- [x] Implement all 12+ error handling paths
- [x] Add GOCLAW_URL and GOCLAW_GATEWAY_TOKEN to `.env.example`
- [x] Verify response format matches webhook-dispatch expectations

## Success Criteria
- Bridge receives webhook-dispatch payload and returns `{reply: "..."}`
- Conversation history correctly mapped to OpenAI messages format (text-only)
- System prompt includes conversation context
- GoClaw agent key resolved from agent_configs metadata
- X-GoClaw-User-Id header sent with sender's ID
- Response extracted from `payload.content` (GoClaw format, not OpenAI)
- Structured logs emitted for every GoClaw call (latency, tokens)
- All error paths return descriptive responses with correct HTTP status codes
- 25s timeout to stay within webhook-dispatch's 30s window

## Risk Assessment
- **GoClaw unreachable:** Return 502, webhook-dispatch retries
- **Invalid agent key:** Return 400, logged in webhook_delivery_logs
- **Response too slow:** 25s timeout, webhook-dispatch retries on next attempt
- **GoClaw response format change:** Extract from `payload.content`; fallback to `choices[0]` if `payload` is missing (future-proofing)
