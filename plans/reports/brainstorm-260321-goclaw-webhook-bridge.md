# Brainstorm: GoClaw Webhook Bridge Integration

**Date:** 2026-03-21
**Decision:** Webhook Bridge API route to connect Agent Playground to hosted GoClaw agents

---

## Problem

Agent Playground uses webhook-based agent dispatch (Supabase DB trigger -> Edge Function -> agent webhook_url). GoClaw agents are hosted on a remote VPS exposing OpenAI-compatible REST API at `/v1/chat/completions`. Need a bridge to translate between the two.

## Chosen Approach: Webhook Bridge

A single Next.js API route (`/api/goclaw/bridge`) that:
1. Receives webhook payload from `webhook-dispatch` Edge Function
2. Translates to OpenAI chat completions format
3. Forwards to GoClaw server
4. Returns `{reply: "..."}` for Edge Function to insert as agent message

### Flow

```
User -> INSERT message -> DB Trigger -> webhook-dispatch Edge Fn
  -> POST /api/goclaw/bridge (webhook payload)
    -> POST goclaw-server/v1/chat/completions (OpenAI format)
    <- OpenAI response
  <- {reply: "agent response"}
  -> INSERT agent reply message
```

## Changes Required

| Component | Change | Effort |
|-----------|--------|--------|
| `src/app/api/goclaw/bridge/route.ts` | New bridge route | Small |
| `.env` | Add GOCLAW_URL, GOCLAW_GATEWAY_TOKEN | Trivial |
| Admin UI agent webhook_url | Point to bridge endpoint | Config |
| webhook-dispatch Edge Fn | No changes | None |

## Key Decisions

- **Agent key mapping**: Store GoClaw agent key in `agent_configs.metadata`
- **History**: Forward conversation history as messages array
- **Auth**: Bearer token via GOCLAW_GATEWAY_TOKEN env var
- **Retry**: Handled by existing webhook-dispatch retry logic (3 attempts, exponential backoff)

## Alternatives Considered

1. **Direct GoClaw webhook** — Payload format mismatch, would need to modify webhook-dispatch or add GoClaw-side adapter. More fragile.
2. **WebSocket streaming** — Best UX but requires significant refactor of message insertion flow. Good Phase 2 candidate.
3. **MCP integration** — Overkill for basic chat relay. Better for extending GoClaw tool capabilities later.

## Risks

- Latency: ~50ms overhead from double hop (negligible vs LLM response time)
- GoClaw downtime: Existing retry logic handles this
- Payload size: GoClaw's context pruning handles long histories

## Provider

- OpenRouter (user's current GoClaw provider)

## Future Enhancements

- WebSocket streaming for real-time token display
- Multi-agent team delegation
- MCP resource exposure (Supabase data for GoClaw agents)
