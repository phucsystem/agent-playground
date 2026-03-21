# Realtime Latency: The 100ms Problem That Broke Trust

**Date**: 2026-03-18 11:45
**Severity**: High (UX frustration, not data loss)
**Component**: Sidebar realtime sync
**Status**: Resolved

## What Happened

Fixed critical UX bug: newly created groups invisible in sidebar for 100ms-2s delay. Completed 4-phase solution:

1. Immediate refetch after group creation
2. Realtime reconnect handling (Supabase channel recovery)
3. New watch on `conversation_members` table inserts
4. Filter conversations subscription to prevent duplicate renders

Users now see new groups instantly. No stale sidebar state.

## The Brutal Truth

This was a **trust-breaking bug**. User creates group → presses Enter → nothing appears → user thinks it failed → user creates it again → duplicate group created. Classic invisible failure pattern.

The frustrating part: all the data was there. The bug wasn't data loss; it was *visibility loss*. The subscription was working, but it was publishing the old conversation list before the new group arrived. Realtime promised "instant" but delivered "eventually instant, maybe."

That gap between expectation and reality is where user trust dies.

## Technical Details

**Root cause**: `get_my_conversations` RPC called on initial load, but new groups arriving via realtime INSERT didn't trigger a refetch. The subscription caught the insert, but the old query result was cached and stale.

**The fix chain**:

1. **Immediate refetch** (use-conversations.ts): After `createConversation` mutation succeeds, manually call `refetch()` for conversations query
2. **Realtime reconnect**: Added handler in layout.ts to re-run `fetchConversations` if realtime channel state changes from `SUBSCRIBED` → reconnecting
3. **Watch conversation_members**: New subscription filter on `conversation_members` inserts (new members = potential new group visibility). Triggers refetch
4. **Filter subscription**: Changed from broad `on('INSERT', ...)` to scoped subscription preventing echo messages

**Critical insight**: `messages` and `conversation_members` tables have **no `workspace_id` column**. Realtime filters by table only, not workspace. This means every INSERT in the app's `conversation_members` table fires for all workspaces. Mitigated via client-side predicate in subscription, but schema debt remains.

## What We Tried

1. Relying on Supabase realtime alone — failed; cache invalidation is hard
2. Polling every 5s for new conversations — worked but expensive
3. Polling only after 2s delay (assumption: group creation takes 2s) — flaky, race conditions
4. Manual subscription to `conversations` table inserts — worked partially; didn't handle all edges

## Root Cause Analysis

Why did this happen? Because realtime subscription architecture didn't account for **query cache lifecycle**. When `get_my_conversations` RPC runs on mount, React Query caches it. Realtime fire updates, but the RPC result was already cached. We had:

- Correct subscription setup
- Correct realtime payload
- Wrong cache invalidation strategy

The Supabase docs don't emphasize this: realtime != automatic React Query cache busting. You must explicitly call `refetch()` or invalidate the query key.

**Secondary issue**: Schema has no workspace isolation on `conversation_members`. If user has multiple workspaces, a realtime INSERT fires for all of them. Not a bug here (single workspace UI), but architectural debt.

## Lessons Learned

- **Invisible failures kill trust**: UX bug that "looks like it failed" is worse than an error. User feedback immediately revealed this.
- **Realtime != cache invalidation**: Publishing data to clients doesn't update cached queries. Must manually refetch or invalidate in React Query.
- **Schema debt surfaces in realtime**: Missing `workspace_id` on junction tables means coarse-grained subscriptions. Layer filtering on client to work around.
- **Refetch after mutation**: Every mutation that creates new entities should immediately `refetch()` that query. This is the pattern; follow it everywhere.

## Next Steps

- Add `workspace_id` to `conversation_members` table (future migration) to enable fine-grained realtime subscriptions
- Add `workspace_id` to `messages` table (same future migration) — currently missing and creates unnecessary realtime noise
- Document realtime + React Query pattern in code comments; this surprised the team
- Audit other mutations for missing refetch() calls

**Critical**: Schema debt with missing workspace_id is minor now (single workspace), but will compound with multi-workspace support.
