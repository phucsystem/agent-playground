# Phase 4: Agent Lifecycle Events

## Context
- [Phase 1: WS Client](phase-01-ws-client-singleton.md) — event subscription via `.on()`
- [GoClaw RPC methods](../reports/researcher-260320-goclaw-integration.md) — event.stream, trace.list

## Overview
- **Priority:** P3 (nice-to-have, builds on Phase 1-3)
- **Status:** complete
- **Effort:** L (human) / M (CC)
- **Depends on:** Phase 1, Phase 3

## Key Insights
- GoClaw pushes async events via `event.stream`: run.started, tool.call, tool.result, run.completed
- These events provide visibility into what the agent is doing (thinking, calling tools, etc.)
- Can show in UI as status updates on streaming messages: "Thinking...", "Calling tool: web_search", "Processing results..."
- Also enables: session history (`session.history`), memory search (`memory.search`), agent management

## Requirements

### Functional
- Subscribe to `event.stream` on WS connection
- Map events to message metadata updates during streaming
- Show agent status in message-item during streaming (e.g., "Searching the web...")
- `session.history` — optional: use for verifying GoClaw session state
- `agent.list` — optional: admin panel shows available GoClaw agents

### Non-Functional
- Events must not block streaming (async processing)
- Event subscription survives reconnection

## Architecture

```
GoClaw Server
  |
  | {"type": "event", "data": {"type": "run.started", "agentId": "...", "timestamp": "..."}}
  | {"type": "event", "data": {"type": "tool.call", "toolName": "web_search", "args": {...}}}
  | {"type": "event", "data": {"type": "tool.result", "result": {...}}}
  | {"type": "event", "data": {"type": "run.completed", "duration": 1200}}
  |
  v
WS Client (event handlers)
  |
  | on('run.started') → UPDATE metadata.agent_status = 'thinking'
  | on('tool.call')   → UPDATE metadata.agent_status = 'Calling: web_search'
  | on('tool.result')  → UPDATE metadata.agent_status = 'Processing results...'
  | on('run.completed') → no-op (already handled by stream end)
  |
  v
Supabase Realtime → Frontend renders status
```

## Implementation Steps (High-Level)

### 1. Subscribe to event.stream on connect
In `ws-client.ts`, after auth handshake:
```typescript
this.send('event.stream', { subscribe: true });
```

### 2. Map events to message metadata
During active streaming in bridge route:
```typescript
const unsubRunStarted = goclawClient.on('run.started', () => {
  supabaseAdmin.from("messages")
    .update({ metadata: { streaming_status: 'streaming', agent_status: 'Thinking...' } })
    .eq("id", streamingMessageId);
});

const unsubToolCall = goclawClient.on('tool.call', (data) => {
  supabaseAdmin.from("messages")
    .update({ metadata: { streaming_status: 'streaming', agent_status: `Calling: ${data.toolName}` } })
    .eq("id", streamingMessageId);
});
```

### 3. Frontend status display
In message-item, during streaming:
```tsx
const agentStatus = (message.metadata as Record<string, unknown>)?.agent_status as string | undefined;
{isStreaming && agentStatus && (
  <span className="text-xs text-muted-foreground">{agentStatus}</span>
)}
```

### 4. Admin panel: agent.list (optional)
Use `goclawClient.send('agent.list', {})` to populate agent selector in admin.

## Todo
- [x] Subscribe to `event.stream` on WS connect
- [x] Map run.started → agent_status: 'Thinking...'
- [x] Map tool.call → agent_status: 'Calling: {toolName}'
- [x] Map tool.result → agent_status: 'Processing...'
- [x] Clean up event subscriptions after stream completes
- [x] Frontend: show agent_status in message-item
- [x] Re-subscribe to event.stream after reconnect
- [x] Optional: agent.list for admin panel

## Success Criteria
- During streaming, UI shows what agent is doing (thinking, calling tools)
- Status updates appear without disrupting content streaming
- Event subscriptions survive WS reconnection

## Risk Assessment
- **Event ordering:** Events may arrive out of order — use timestamp for ordering
- **Event flood:** High-frequency events could overwhelm Supabase UPDATEs — debounce status updates (500ms)
- **Scope creep:** This phase is the largest — can be deferred without breaking Phase 1-3
