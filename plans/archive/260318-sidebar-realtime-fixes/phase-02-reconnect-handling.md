# Phase 02 — Realtime Reconnect Handling

## Status: pending
## Priority: HIGH

## Problem
`useConversations` calls `.subscribe()` with no callback.
If the WebSocket drops (network blip, Supabase restart, browser sleep), the channel silently stops delivering events. Sidebar goes stale indefinitely.

**Current code** (`use-conversations.ts:63`):
```ts
.subscribe();
```

## Solution
Pass a status callback to `.subscribe()`. On `SUBSCRIBED`, re-fetch conversations to sync any missed events.

## Related Files
- `src/hooks/use-conversations.ts`

## Implementation Steps

**File:** `src/hooks/use-conversations.ts` — line 63

Change:
```ts
.subscribe();
```
To:
```ts
.subscribe((status) => {
  if (status === "SUBSCRIBED") {
    fetchConversations();
  }
});
```

This fires:
1. On initial subscription (harmless double-fetch, replaces the `fetchConversations()` at line 28 — but keep both for safety)
2. On re-subscription after a drop (critical recovery path)

## Notes
- Supabase subscribe statuses: `"SUBSCRIBED"` | `"TIMED_OUT"` | `"CLOSED"` | `"CHANNEL_ERROR"`
- Only `SUBSCRIBED` needs a refetch — others indicate failure (future work: error toast)
- The initial `fetchConversations()` call at line 28 should stay as-is (fires before subscribe completes)

## Success Criteria
- After network reconnect, sidebar automatically re-syncs within ~1s
- No manual refresh needed after laptop wakes from sleep

## Risk
Low. Adding a callback to an existing subscribe call. No state shape changes.
