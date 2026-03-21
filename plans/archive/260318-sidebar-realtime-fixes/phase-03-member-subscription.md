# Phase 03 — Watch conversation_members Inserts

## Status: pending
## Priority: MEDIUM

## Problem
`useConversations` does not subscribe to `conversation_members` table.

**Missing scenario:** User B is added to an existing group by admin. The `conversations` row is NOT inserted or updated. The `messages` table gets no new INSERT. The only way User B's sidebar updates is:
- A message is sent in that group (triggers `messages INSERT`)
- User B refreshes the page

## Solution
Add a `postgres_changes` subscription on `conversation_members INSERT`.

## Related Files
- `src/hooks/use-conversations.ts`

## Implementation Steps

**File:** `src/hooks/use-conversations.ts` — after line 62 (before `.subscribe()`)

Add:
```ts
.on(
  "postgres_changes",
  { event: "INSERT", schema: "public", table: "conversation_members" },
  () => {
    fetchConversations();
  }
)
```

Full channel chain after change:
```ts
const channel = supabase
  .channel(`conversation-updates-${workspaceId}`)
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => fetchConversations())
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations" }, () => fetchConversations())
  .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations" }, () => fetchConversations())
  .on("postgres_changes", { event: "DELETE", schema: "public", table: "conversations" }, () => fetchConversations())
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversation_members" }, () => fetchConversations())  // ← new
  .subscribe(...);
```

## Notes
- `conversation_members` has no `workspace_id` column — no filter possible
- This will fire for ALL `conversation_members` inserts across all workspaces
- `get_my_conversations` RPC already filters by workspace and membership, so correctness is maintained; just slightly more refetches
- Could optimize by filtering in the callback (compare returned conversations to current), but YAGNI

## Success Criteria
- Admin adds User B to an existing group → User B's sidebar shows the new group within ~1s (realtime latency)

## Risk
Low. Additive subscription. Slight increase in `fetchConversations` call frequency in busy multi-workspace setups.
