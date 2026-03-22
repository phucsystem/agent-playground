# Phase 1: WebSocket Client Singleton

## Context
- [GoClaw WS RPC protocol](../reports/researcher-260320-goclaw-integration.md) — connect, chat.stream, event.stream
- [Brainstorm](../reports/brainstorm-260323-goclaw-websocket-migration.md) — architecture decisions

## Overview
- **Priority:** P1 (foundation for all other phases)
- **Status:** complete
- **Effort:** S (human) / S (CC)

## Key Insights
- GoClaw WS protocol: JSON-RPC over WebSocket with `type: req/res/event`
- Auth via `connect` method with token param (not header)
- Request/response correlation via `id` field
- Auto-reconnect needed — Next.js may kill serverless process on cold start
- Rate limit: 30 messages/sec per connection (token bucket)

## Requirements

### Functional
- Persistent WebSocket connection to GoClaw server
- Auth handshake on connect (`connect` method with gateway token)
- Request/response correlation (match response `id` to pending request)
- Event subscription (`event.stream` for async pushes)
- Auto-reconnect with exponential backoff on disconnect
- Graceful queue: requests during reconnect are queued, sent after re-auth

### Non-Functional
- Module-level singleton (shared across all API route invocations)
- Max reconnect interval: 30s
- Connection timeout: 10s
- Request timeout: 25s (match existing bridge timeout)

## Architecture

```
Module-level singleton (goclaw-ws-client.ts)
  |
  | new GoclawWSClient(url, token)
  |   - ws: WebSocket | null
  |   - pendingRequests: Map<string, {resolve, reject, timeout}>
  |   - eventHandlers: Map<string, callback[]>
  |   - state: connecting | connected | reconnecting | closed
  |   - requestIdCounter: number
  |
  | .connect() → auth handshake, set state=connected
  | .send(method, params) → Promise<response> (auto-connect if needed)
  | .stream(method, params, onChunk) → Promise<void> (for chat.stream)
  | .on(eventType, callback) → unsubscribe fn (for event.stream)
  | .close() → graceful shutdown
  |
  | Auto-reconnect:
  |   disconnect detected → state=reconnecting
  |   exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
  |   on reconnect → re-auth, replay queued requests
```

## Related Code Files
- **Create:** `src/lib/goclaw/ws-client.ts`
- **Create:** `src/lib/goclaw/index.ts` (singleton export)
- **Read:** `src/app/api/goclaw/bridge/route.ts` (will consume in Phase 2)

## Implementation Steps

### 1. Install ws package
```bash
npm install ws
npm install -D @types/ws
```

### 2. Create GoclawWSClient class
`src/lib/goclaw/ws-client.ts`

Core class with:
- Constructor takes `url`, `token`, optional config
- Private `ws` instance, `pendingRequests` map, `eventHandlers` map
- State machine: `idle` → `connecting` → `connected` ↔ `reconnecting` → `closed`

### 3. Implement connect/auth
```typescript
async connect(): Promise<void> {
  this.state = 'connecting';
  this.ws = new WebSocket(this.url);

  this.ws.on('open', () => {
    // Send auth handshake
    this.sendRaw({
      type: 'req',
      id: this.nextId(),
      method: 'connect',
      params: { token: this.token, user_id: 'system' }
    });
  });

  // Wait for auth response
  // Set state = 'connected' on success
}
```

### 4. Implement request/response correlation
```typescript
async send(method: string, params: Record<string, unknown>): Promise<unknown> {
  await this.ensureConnected();
  const requestId = this.nextId();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      this.pendingRequests.delete(requestId);
      reject(new Error(`Request timeout: ${method}`));
    }, this.requestTimeoutMs);

    this.pendingRequests.set(requestId, { resolve, reject, timeout });
    this.sendRaw({ type: 'req', id: requestId, method, params });
  });
}
```

### 5. Implement streaming (chat.stream)
```typescript
async stream(
  method: string,
  params: Record<string, unknown>,
  onChunk: (chunk: string) => void,
): Promise<string> {
  await this.ensureConnected();
  const requestId = this.nextId();
  let fullContent = '';

  return new Promise((resolve, reject) => {
    this.pendingRequests.set(requestId, {
      onChunk: (data) => {
        if (data.chunk) {
          fullContent += data.chunk;
          onChunk(data.chunk);
        }
        if (data === null) {
          // End marker
          this.pendingRequests.delete(requestId);
          resolve(fullContent);
        }
      },
      reject,
      timeout: setTimeout(() => reject(new Error('Stream timeout')), this.requestTimeoutMs),
    });

    this.sendRaw({ type: 'req', id: requestId, method, params });
  });
}
```

### 6. Implement event subscription
```typescript
on(eventType: string, callback: (data: unknown) => void): () => void {
  const handlers = this.eventHandlers.get(eventType) || [];
  handlers.push(callback);
  this.eventHandlers.set(eventType, handlers);

  // Return unsubscribe function
  return () => {
    const remaining = (this.eventHandlers.get(eventType) || [])
      .filter(handler => handler !== callback);
    this.eventHandlers.set(eventType, remaining);
  };
}
```

### 7. Implement message router
Handle incoming WS messages:
```typescript
// type: 'res' → match by id, resolve/reject pending request
// type: 'res' with data.chunk → streaming response, call onChunk
// type: 'res' with data: null → stream end marker
// type: 'event' → dispatch to matching eventHandlers
```

### 8. Implement auto-reconnect
```typescript
private scheduleReconnect(): void {
  if (this.state === 'closed') return;
  this.state = 'reconnecting';

  const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000);
  this.reconnectAttempts++;

  setTimeout(async () => {
    try {
      await this.connect();
      this.reconnectAttempts = 0;
      // Replay queued requests
      this.flushQueue();
    } catch {
      this.scheduleReconnect();
    }
  }, delay);
}
```

### 9. Create singleton export
`src/lib/goclaw/index.ts`
```typescript
import { GoclawWSClient } from './ws-client';

const GOCLAW_URL = process.env.GOCLAW_URL;
const GOCLAW_TOKEN = process.env.GOCLAW_GATEWAY_TOKEN;

let client: GoclawWSClient | null = null;

export function getGoclawClient(): GoclawWSClient {
  if (!client && GOCLAW_URL && GOCLAW_TOKEN) {
    const wsUrl = GOCLAW_URL.replace(/^http/, 'ws') + '/ws';
    client = new GoclawWSClient(wsUrl, GOCLAW_TOKEN);
  }
  if (!client) throw new Error('GoClaw not configured');
  return client;
}
```

## Todo
- [x] Install `ws` and `@types/ws`
- [x] Create `src/lib/goclaw/ws-client.ts` with GoclawWSClient class
- [x] Implement connect/auth handshake
- [x] Implement send (request/response with correlation)
- [x] Implement stream (chat.stream with chunk callbacks)
- [x] Implement event subscription (on/off)
- [x] Implement message router (res/event dispatch)
- [x] Implement auto-reconnect with exponential backoff
- [x] Implement request queue during reconnect
- [x] Create `src/lib/goclaw/index.ts` singleton export
- [x] Verify WS connection to GoClaw server

## Success Criteria
- `getGoclawClient().send('agent.list', {})` returns agent list
- `getGoclawClient().stream('chat.stream', {...}, onChunk)` delivers chunks
- Connection auto-reconnects within 30s after drop
- Queued requests are replayed after reconnect

## Risk Assessment
- **GoClaw WS endpoint unavailable:** Log error, all bridge requests fail with 502
- **Cold start reconnect:** First request after idle waits for auth handshake (~200ms)
- **Memory leak:** Clean up pendingRequests on timeout, close event handlers on disconnect
