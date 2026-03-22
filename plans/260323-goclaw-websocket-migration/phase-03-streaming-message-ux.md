# Phase 3: Frontend Streaming Message UX

## Context
- [use-realtime-messages](../../src/hooks/use-realtime-messages.ts) — existing realtime hook
- [use-typewriter](../../src/hooks/use-typewriter.ts) — existing typewriter animation
- [message-item](../../src/components/chat/message-item.tsx) — message renderer
- [database types](../../src/types/database.ts) — Message interface

## Overview
- **Priority:** P2
- **Status:** complete
- **Effort:** M (human) / S (CC)
- **Depends on:** Phase 2

## Key Insights
- Streaming chunks arrive via **Supabase Realtime postgres_changes UPDATE** (not ephemeral broadcast for simplicity)
- DB updates on streaming message content every 200ms with accumulated chunks
- Chunks accumulate in database, visible through postgres_changes realtime events
- Final message arrives via postgres_changes UPDATE with streaming_status: 'complete'
- When final UPDATE arrives, clear streaming indicator — render full content normally
- `use-typewriter` must be disabled during streaming (server drives the reveal, not client)

## Design Spec (from /plan-design-review)

### Visual States
```
STATE       | USER SEES                                       | TRIGGER
------------|------------------------------------------------|--------
idle        | Normal message bubble                           | Default
dots        | 3 bouncing dots in agent bubble (no text yet)  | Broadcast subscribe, before first chunk
streaming   | Partial markdown + block cursor (█)             | First chunk arrives (instant swap from dots)
complete    | Full message, normal render, no cursor           | Final INSERT from webhook-dispatch
error       | Partial text + amber "Response interrupted" pill | 60s timeout or stream error
```

### Cursor: Block cursor
- Shape: solid rectangle `w-2 h-4`
- Color: `text-current` (inherits zinc-700 in light mode)
- Animation: `animate-pulse` overridden to **0.8s cycle** (not default 2s — feels snappier)
- Position: `inline-block ml-0.5` after last character

### Typing Dots
- 3 circles: `w-2 h-2 rounded-full bg-current`
- Animation: `animate-bounce` with 150ms stagger (0ms, 150ms, 300ms)
- Container: `flex gap-1 py-1`

### Error Badge (amber warning, not red error)
- Style: `text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5`
- Text: "Response interrupted"
- Semantic: warning (partial content is still useful), not error

### Transitions
- Dots → Content: **instant swap** (no fade/crossfade). Matches DESIGN.md "minimal-functional" motion.
- Content → Complete: seamless — cursor disappears, content is already rendered
- Timeout: 60s stale streaming state → clear local state, no visible transition

## Requirements

### Functional
- Detect streaming messages via `metadata.streaming_status`
- Render partial content as it arrives (Supabase Realtime UPDATEs)
- Show pulsing cursor/indicator at end of streaming content
- Remove indicator when `streaming_status` changes to `'complete'`
- Handle `streaming_status: 'error'` — show error state

### Non-Functional
- No flicker during rapid content updates
- Smooth scroll-to-bottom as content grows
- No new Supabase subscriptions (reuse existing UPDATE handler)

## Architecture

```
Supabase Realtime UPDATE
    |
    v
use-realtime-messages (existing UPDATE handler)
    |
    | patches: content, metadata (incl. streaming_status)
    v
React Query cache updated
    |
    v
message-item re-renders
    |
    | if metadata.streaming_status === 'streaming':
    |   render partial content + blinking cursor
    | if 'complete': render full content (normal)
    | if 'error': render partial content + error badge
    v
User sees progressive token streaming
```

## Related Code Files
- **Modify:** `src/components/chat/message-item.tsx` (add streaming state)
- **Modify:** `src/components/chat/message-list.tsx` (auto-scroll during streaming)
- **Read:** `src/hooks/use-realtime-messages.ts` (verify UPDATE handler works)
- **Read:** `src/types/database.ts` (Message.metadata type)

## Implementation Steps

### 1. Add streaming detection helper
In `message-item.tsx`:
```typescript
type StreamingStatus = "streaming" | "complete" | "error" | undefined;

function getStreamingStatus(message: MessageWithSender): StreamingStatus {
  return (message.metadata as Record<string, unknown>)?.streaming_status as StreamingStatus;
}
```

### 2. Render streaming indicator
In message-item's content rendering section:
```tsx
const streamingStatus = getStreamingStatus(message);
const isStreaming = streamingStatus === "streaming";
const isStreamError = streamingStatus === "error";

// In JSX:
{message.content && <MarkdownContent content={message.content} />}
{isStreaming && (
  <span
    className="inline-block w-2 h-4 bg-current ml-0.5"
    style={{ animation: "pulse 0.8s ease-in-out infinite" }}
  />
)}
{isStreamError && (
  <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 ml-2">
    Response interrupted
  </span>
)}
```

### 3. Disable typewriter for streaming messages
The existing `useTypewriter` hook animates the full text client-side. For streaming messages, content arrives progressively from the server — typewriter would fight with it.

```typescript
const shouldTypewrite = isAgentMessage && isRecentMessage(message.created_at) && !isStreaming;
```

### 4. Auto-scroll during streaming
In `message-list.tsx`, ensure scroll-to-bottom triggers on content UPDATE (not just INSERT):
- Existing auto-scroll likely triggers on message count change
- For streaming: content of existing message grows — need to also scroll when last message content changes
- Add dependency on last message content length or metadata change

### 5. Verify UPDATE handler coverage
The existing UPDATE handler in `use-realtime-messages.ts` (line 126-159) already:
- Patches `content`, `edited_at`, `is_deleted`, `metadata`
- Preserves `sender` (not in realtime payload)
- Invalidates conversations query (sidebar preview)

This is sufficient — metadata.streaming_status will be included in the UPDATE payload.

### 6. Handle empty content during initial streaming
When bridge INSERTs placeholder message (content='', streaming_status='streaming'), the Realtime INSERT event arrives. The message-item should render a typing indicator when content is empty and streaming:

```tsx
{!message.content && isStreaming && (
  <div className="flex gap-1 py-1">
    <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
    <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
    <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
  </div>
)}
```

## Todo
- [x] Add streaming status detection helper to message-item
- [x] Render blinking cursor for streaming messages
- [x] Render typing dots for empty streaming messages
- [x] Render error badge for failed streams
- [x] Disable typewriter animation for streaming messages
- [x] Ensure auto-scroll works during content UPDATEs
- [x] Verify UPDATE handler patches metadata correctly
- [x] Test end-to-end: message appears → dots → streaming text → complete

## Success Criteria
- Streaming message shows typing dots immediately after placeholder INSERT
- Content appears progressively as chunks arrive
- Blinking cursor visible at end of partial content
- Cursor disappears when streaming completes
- Error state shows "(response interrupted)" badge
- Auto-scroll keeps latest content visible
- No flicker during rapid content updates

## Risk Assessment
- **Rapid re-renders:** React Query deduplicates, metadata comparison in UPDATE handler prevents no-op renders
- **Scroll jank:** Debounced UPDATE (200ms in Phase 2) limits re-render frequency
- **Stale streaming state:** If bridge crashes, message stays "streaming" forever — need cleanup job or timeout on frontend (e.g., treat streaming messages older than 60s as error)
