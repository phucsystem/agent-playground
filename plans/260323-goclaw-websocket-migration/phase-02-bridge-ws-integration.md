# Phase 2: Replace REST Bridge with WebSocket

## Context
- [Phase 1: WS Client](phase-01-ws-client-singleton.md) — singleton client
- [Current bridge](../../src/app/api/goclaw/bridge/route.ts) — REST bridge to replace
- [webhook-dispatch](../../supabase/functions/webhook-dispatch/index.ts) — caller

## Overview
- **Priority:** P1
- **Status:** complete
- **Effort:** M (human) / M (CC)
- **Depends on:** Phase 1

## Key Insights
- webhook-dispatch expects `{reply: "..."}` from bridge — this contract stays the same
- Bridge currently does: validate auth → lookup agent → REST call → return reply
- New flow: validate auth → lookup agent → INSERT streaming msg → WS chat.stream → UPDATE chunks → return reply
- The bridge route remains an HTTP POST handler — only the GoClaw communication changes from REST to WS
- Streaming state tracked via `metadata.streaming_status` on messages (no migration needed)

## Requirements

### Functional
- Bridge route receives webhook-dispatch payload (same as today)
- Auth validation and agent config lookup (same as today)
- INSERT a placeholder message with `metadata.streaming_status: 'streaming'`
- Send `chat.stream` via WS singleton
- UPDATE message content as chunks arrive (batched every 200ms)
- Final UPDATE sets `metadata.streaming_status: 'complete'` with full content
- Return `{reply: full_content}` to webhook-dispatch (same contract)

### Non-Functional
- Total timeout: 25s (same as today)
- If WS fails to connect, return 502 (same error contract)
- Chunk UPDATE debounce: 200ms (avoid flooding Supabase Realtime)

## Architecture

```
webhook-dispatch
  |
  | POST /api/goclaw/bridge
  | (same payload as today)
  v
Bridge Route (route.ts)
  |
  | 1. Validate auth (UNCHANGED)
  | 2. Lookup agent_configs (UNCHANGED)
  | 3. Get sender_id from history (UNCHANGED)
  |
  | 4. INSERT placeholder message to Supabase
  |    sender_id = agent's user_id
  |    content = '' (empty)
  |    metadata = { streaming_status: 'streaming' }
  |
  | 5. chat.stream via WS singleton
  |    onChunk: accumulate content, debounced UPDATE every 200ms
  |
  | 6. Final UPDATE: content = full text, metadata.streaming_status = 'complete'
  |
  | 7. Return {reply: full_content} to webhook-dispatch
  |    webhook-dispatch will try to INSERT agent reply — but it already exists
  |    Need: webhook-dispatch must detect existing reply and skip INSERT
  v
```

## Critical Design Decision: Duplicate Message Prevention

The bridge INSERTs the streaming message directly. But webhook-dispatch ALSO inserts the reply when bridge returns `{reply: ...}`. This would create duplicates.

**Solution:** Return `{reply: content, already_inserted: true}` from bridge. Modify webhook-dispatch to check this flag and skip INSERT.

**Alternative:** Bridge does NOT insert the message. Only streams chunks to a temporary state. webhook-dispatch inserts the final message. Frontend shows typing indicator but no progressive content.

**Recommended:** Bridge inserts + streams. webhook-dispatch skips insert on `already_inserted: true`. Best UX — users see tokens immediately.

## Related Code Files
- **Modify:** `src/app/api/goclaw/bridge/route.ts` (replace REST with WS)
- **Modify:** `supabase/functions/webhook-dispatch/index.ts` (handle `already_inserted`)
- **Read:** `src/lib/goclaw/index.ts` (Phase 1 singleton)

## Implementation Steps

### 1. Remove REST fetch helpers
Delete `goclawFetch()` and `handleGoclawResponse()` from route.ts — no longer needed.

### 2. Import WS singleton
```typescript
import { getGoclawClient } from "@/lib/goclaw";
```

### 3. Replace GoClaw communication block
After auth validation and agent config lookup:

```typescript
// INSERT placeholder streaming message
const { data: streamingMsg, error: insertError } = await supabaseAdmin
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

// Stream via WebSocket
let accumulatedContent = "";
let lastUpdateTime = 0;
const UPDATE_DEBOUNCE_MS = 200;

try {
  const goclawClient = getGoclawClient();
  const fullContent = await goclawClient.stream(
    "chat.stream",
    { agentId: goclawAgentKey, message: message.content },
    async (chunk: string) => {
      accumulatedContent += chunk;
      const now = Date.now();
      if (now - lastUpdateTime >= UPDATE_DEBOUNCE_MS) {
        lastUpdateTime = now;
        await supabaseAdmin
          .from("messages")
          .update({ content: accumulatedContent })
          .eq("id", streamingMessageId);
      }
    },
  );

  // Final update with complete content
  await supabaseAdmin
    .from("messages")
    .update({
      content: fullContent,
      metadata: { streaming_status: "complete" },
    })
    .eq("id", streamingMessageId);

  const latencyMs = Date.now() - startTime;
  console.log(`[bridge] GoClaw WS stream completed`, {
    agentKey: goclawAgentKey,
    conversationId,
    webhookId,
    endpoint: "chat.stream",
    latencyMs,
    replyLength: fullContent.length,
  });

  return NextResponse.json({ reply: fullContent, already_inserted: true });
} catch (streamError) {
  // On stream failure: update message to error state
  await supabaseAdmin
    .from("messages")
    .update({
      content: accumulatedContent || "[Agent response failed]",
      metadata: { streaming_status: "error" },
    })
    .eq("id", streamingMessageId);

  throw streamError; // Re-throw to hit outer catch
}
```

### 4. Update webhook-dispatch to handle already_inserted

In `supabase/functions/webhook-dispatch/index.ts`, after parsing agent response:

```typescript
const replyContent = agentResponse.reply || agentResponse.message || agentResponse.content;
const alreadyInserted = agentResponse.already_inserted === true;

if (replyContent && !alreadyInserted) {
  // Existing INSERT logic
  const { error: insertError } = await supabase.from("messages").insert({...});
  ...
} else if (replyContent && alreadyInserted) {
  console.log(`[webhook] Agent ${config.user_id} reply already inserted (streaming), skipping`);
}
```

### 5. Error handling matrix

| Condition | Action |
|-----------|--------|
| WS not connected | Try connect, fail with 502 if timeout |
| chat.stream timeout | Update msg to error state, return 504 |
| WS disconnects mid-stream | Update msg with partial content + error status |
| Supabase INSERT fails | Return 500, no streaming attempted |
| Supabase UPDATE fails | Log error, continue streaming (content in reply) |

### 6. Keep SSRF check and auth validation
The auth validation, SSRF check, and agent config lookup sections remain UNCHANGED.

## Todo
- [x] Remove REST fetch helpers from route.ts
- [x] Import WS singleton from `@/lib/goclaw`
- [x] INSERT placeholder streaming message before WS call
- [x] Implement chat.stream with debounced UPDATE callbacks
- [x] Final UPDATE with streaming_status: 'complete'
- [x] Return {reply, already_inserted: true} to webhook-dispatch
- [x] Update webhook-dispatch to skip INSERT on already_inserted
- [x] Error handling: update message to error state on failure
- [x] Verify end-to-end flow: send message → see streaming → see final reply

## Success Criteria
- User sends message → sees streaming tokens within 2s
- Final message content matches full GoClaw response
- webhook-dispatch does not create duplicate message
- On GoClaw failure, message shows error state (not stuck on "streaming")
- webhook_delivery_logs show "delivered" status

## Risk Assessment
- **Duplicate messages:** Mitigated by `already_inserted` flag
- **Partial content on error:** Message updated with whatever was received + error status
- **Supabase UPDATE flood:** Debounced to 200ms intervals
- **webhook-dispatch timeout:** Bridge must complete within 25s; if WS is slow, partial content is saved
