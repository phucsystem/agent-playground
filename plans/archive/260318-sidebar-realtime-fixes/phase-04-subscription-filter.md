# Phase 04 — Filter Conversations Subscription

## Status: pending
## Priority: LOW (performance, not correctness)

## Problem
Current subscriptions have no filters — they receive events for ALL rows across ALL workspaces:
```ts
{ event: "INSERT", schema: "public", table: "conversations" }   // all workspaces
{ event: "INSERT", schema: "public", table: "messages" }        // all workspaces
```

In a large multi-workspace deployment, every message from every workspace triggers `fetchConversations()` for every connected user.

## Schema Context
- `conversations` table has `workspace_id` ✅ — filter applicable
- `messages` table has NO `workspace_id` ❌ — cannot filter at realtime level
- `conversation_members` has NO `workspace_id` ❌ — cannot filter at realtime level

## Solution
Add `filter` to the `conversations` subscription only (the one table that has `workspace_id`).

## Related Files
- `src/hooks/use-conversations.ts`

## Implementation Steps

**File:** `src/hooks/use-conversations.ts`

Change all 3 `conversations` event subscriptions to include a filter:

```ts
// INSERT
.on(
  "postgres_changes",
  { event: "INSERT", schema: "public", table: "conversations", filter: `workspace_id=eq.${workspaceId}` },
  () => fetchConversations()
)
// UPDATE
.on(
  "postgres_changes",
  { event: "UPDATE", schema: "public", table: "conversations", filter: `workspace_id=eq.${workspaceId}` },
  () => fetchConversations()
)
// DELETE
.on(
  "postgres_changes",
  { event: "DELETE", schema: "public", table: "conversations", filter: `workspace_id=eq.${workspaceId}` },
  () => fetchConversations()
)
```

## Notes
- Supabase `filter` uses PostgREST syntax: `column=eq.value`
- Filter evaluated server-side — reduces WebSocket traffic, not just client processing
- `workspaceId` is already in the channel name, so this is logically consistent
- `messages` subscription remains unfiltered — acceptable since `get_my_conversations` RPC scopes by workspace anyway

## Success Criteria
- In a 10-workspace setup, receiving a message in workspace B doesn't trigger `fetchConversations()` for users in workspace A

## Risk
Low-Medium. Supabase realtime filters require the `postgres_changes` feature to be enabled with the right RLS. If the filter causes issues (Supabase bug, schema mismatch), it can be removed without affecting functionality. Test in dev first.

## Defer criteria
If current scale is small (1–3 workspaces, <50 users), this phase can be deferred indefinitely. Only implement if performance impact is measurable.
