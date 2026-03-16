# Code Review: Multi-Workspace Support

**Date:** 2026-03-17
**Reviewer:** code-reviewer
**Scope:** 17 files (5 new, 12 modified), ~800 LOC added
**Build:** `pnpm build` and `tsc --noEmit` both clean

---

## Overall Assessment

Solid implementation of Discord-style workspace isolation. Migration is well-structured with DEFINER helpers avoiding RLS recursion. Context/hooks plumbing is clean. Several issues found ranging from a critical data leak to medium-priority stale state bugs.

---

## Critical Issues

### C1. `get_my_conversations` RPC not updated -- returns cross-workspace data

**File:** `supabase/migrations/018_workspaces.sql` (missing update), `src/hooks/use-conversations.ts`

The `get_my_conversations()` RPC (last defined in `010_archive_group.sql`) returns **all** conversations for the user across all workspaces. It does not filter by `workspace_id`. The client-side filter in `use-conversations.ts:21-22` masks this:

```ts
setConversations(
  allConversations.filter((conv) => conv.workspace_id === workspaceId)
);
```

**Problems:**
1. **Data leak over the wire** -- all workspace conversation metadata (names, last messages, unread counts) is sent to the client even for workspaces the user is not currently viewing. An attacker inspecting network traffic sees everything.
2. **Performance** -- fetches all conversations across all workspaces on every message insert and conversation delete, then filters client-side.
3. **The RPC doesn't return `workspace_id`** in its output, so the client filter `conv.workspace_id === workspaceId` likely evaluates to `undefined === workspaceId` and **filters out everything** unless `workspace_id` happens to be included in the JSON output via `row_to_json`.

**Fix:** Add `workspace_id` to the RPC's SELECT list and add a `ws_id uuid` parameter to `get_my_conversations()` with a `WHERE conv.workspace_id = ws_id` filter. Update the TypeScript Function signature in `database.ts` and the RPC call in `use-conversations.ts`.

```sql
CREATE OR REPLACE FUNCTION get_my_conversations(ws_id uuid)
RETURNS json AS $$
-- ... existing body, add to WHERE clause:
-- AND conv.workspace_id = ws_id
```

### C2. Workspace creation missing member auto-add

**File:** `src/components/sidebar/workspace-rail.tsx:92-98`

`CreateWorkspaceDialog` inserts into `workspaces` table directly but never adds the creating admin to `workspace_members`. The `workspaces_insert` RLS policy restricts to admins, but there's no trigger or logic to auto-add the creator as a member. After creation, the workspace appears in the refetched list only if the admin happens to be added elsewhere.

**Fix:** After the workspace insert, also insert a row into `workspace_members` for the current user. Or create a `create_workspace` SECURITY DEFINER function that does both atomically.

---

## High Priority

### H1. `usePinnedConversations` does not re-initialize on workspace switch

**File:** `src/hooks/use-pinned-conversations.ts:28-30`

`useState` initializer runs once. When `workspaceId` changes (user switches workspace), `pinnedIds` state retains the previous workspace's pins until a `cleanStalePins` call happens to fire.

```ts
const [pinnedIds, setPinnedIds] = useState<string[]>(() =>
  readPinnedIds(userId, workspaceId)  // only runs on mount
);
```

**Fix:** Add a `useEffect` that re-reads pinned IDs from localStorage when `workspaceId` changes:

```ts
useEffect(() => {
  setPinnedIds(readPinnedIds(userId, workspaceId));
}, [userId, workspaceId]);
```

### H2. Conversations RLS now requires BOTH membership checks -- potential perf regression

**File:** `supabase/migrations/018_workspaces.sql:115-119`

```sql
CREATE POLICY "conversations_select" ON conversations FOR SELECT
  USING (
    id = ANY(my_conversation_ids())
    AND workspace_id = ANY(my_workspace_ids())
  );
```

Both `my_conversation_ids()` and `my_workspace_ids()` are SECURITY DEFINER functions that each query a join table. Every row evaluation calls both. For users with many conversations/workspaces, this could be slow. Consider combining into a single function or using a materialized check.

### H3. `ConversationPage` creates duplicate presence/conversation subscriptions

**File:** `src/app/chat/[conversationId]/page.tsx:29-30`

```ts
const { conversations, refetch: refetchConversations } = useConversations(activeWorkspace?.id ?? null);
const { onlineUsers } = useSupabasePresence(currentUser ?? null, activeWorkspace?.id ?? null);
```

Both hooks are already called in `layout.tsx` (the parent). The conversation page creates a **second** Supabase channel subscription for both presence and conversation updates. This doubles realtime connections per active chat page.

**Fix:** Pass `conversations` and `onlineUsers` down via context or props from layout instead of re-calling hooks in child pages.

### H4. No error feedback on workspace create/member operations

**Files:** `workspace-rail.tsx:100-103`, `workspace-members.tsx:57-62`, `workspace-members.tsx:67-72`

All mutating operations silently swallow errors:

```ts
if (error) {
  setCreating(false);
  return;  // no user feedback
}
```

User has no idea why an operation failed. Add `toast.error()` or similar.

---

## Medium Priority

### M1. Workspace delete race condition with conversation reassignment

**File:** `src/app/admin/page.tsx:338-353`

The delete flow does two separate operations: (1) move conversations to default workspace, (2) delete workspace. These are not atomic. If another user creates a conversation in the workspace between steps 1 and 2, it gets orphaned (FK constraint violation on delete due to CASCADE not covering this path, or lost if CASCADE does fire).

**Fix:** Create a `delete_workspace` SECURITY DEFINER function that does both in a transaction, or use a DB trigger on workspace delete that reassigns conversations.

### M2. `fetchMembers` in `workspace-members.tsx` missing deps warning

**File:** `src/components/admin/workspace-members.tsx:51-53`

```ts
useEffect(() => {
  fetchMembers();
}, [workspace.id]);
```

`fetchMembers` is not in the dependency array and is not wrapped in `useCallback`. While functionally fine (it reads workspace from closure), it's a correctness risk if the component is refactored.

### M3. Admin page `fetchWorkspaces` fetches ALL workspace members for counting

**File:** `src/app/admin/page.tsx:224-233`

Fetches every `workspace_members` row just to count members per workspace. For large deployments, this is wasteful.

**Fix:** Use a Supabase aggregation query or add a `member_count` view/function.

### M4. `all-users.tsx` fallback branch queries `users_public` view

**File:** `src/components/sidebar/all-users.tsx:39-44`

The else-branch (no active workspace) queries `users_public` which may not exist or may return users from all workspaces. This branch should arguably never execute given the workspace context always loads, but it's a potential leak path.

### M5. New user invite not auto-added to any workspace

**File:** `src/app/admin/page.tsx:257-305`

When creating a new user via the invite form, the user is not added to any workspace. They won't appear in any workspace's user list until manually added via workspace member management. The backfill migration only adds existing active users.

**Fix:** Auto-add new users to the default workspace on creation (via trigger or in the invite handler).

---

## Low Priority

### L1. `workspace-rail-width` CSS variable defined but unused

**File:** `src/app/globals.css:40`

The `--workspace-rail-width: 60px` variable is defined but the rail width is hardcoded as `w-[60px]` in both `layout.tsx:132` and `workspace-rail.tsx:20`. Consider using the variable for consistency.

### L2. `workspace-rail.tsx` creates Supabase client inline

The `CreateWorkspaceDialog` calls `createBrowserSupabaseClient()` inside the handler. Consistent with the rest of the codebase but worth noting -- multiple client instances per component.

### L3. Mobile workspace strip lacks scroll indicator

**File:** `src/app/chat/layout.tsx:152-171`

The horizontal workspace strip on mobile has `overflow-x-auto` but no visual scroll indicator. With many workspaces, users may not realize they can scroll.

---

## Edge Cases Found by Scout

1. **Workspace switch while message is being composed** -- No confirmation dialog or draft preservation. User could lose typed message on workspace switch.
2. **DM deduplication across workspaces** -- By design, same two users can have separate DMs in different workspaces. This is correct per the plan (workspace-scoped DMs), but could confuse users.
3. **Agent messages not workspace-scoped** -- Plan states agents are global, but agents appear in workspace member lists only if explicitly added. Agent DMs in one workspace won't appear in another -- this is correct but should be documented.
4. **Realtime subscription cleanup on rapid workspace switching** -- `useSupabasePresence` and `useConversations` both unsubscribe/resubscribe on workspace change. Rapid switching could create orphaned channels if cleanup is slow.

---

## Positive Observations

- Clean DEFINER pattern for RLS helpers prevents recursion issues
- Unique partial index on `is_default` prevents multiple default workspaces
- Backfill migration is well-structured: nullable column -> backfill -> NOT NULL
- Discord-style rail UI is well-implemented with tooltips and active indicators
- Mobile responsive design with horizontal strip is a good UX choice
- `conversations_delete` RLS properly blocks deleting default workspace
- localStorage-based workspace persistence per user is appropriate

---

## Recommended Actions (Priority Order)

1. **[CRITICAL]** Update `get_my_conversations()` RPC to accept `ws_id` parameter and filter server-side
2. **[CRITICAL]** Add creator to `workspace_members` after workspace creation
3. **[HIGH]** Fix `usePinnedConversations` stale state on workspace switch
4. **[HIGH]** Remove duplicate hook calls in `ConversationPage` -- use context from layout
5. **[HIGH]** Add error feedback (toast) on all workspace mutation failures
6. **[MEDIUM]** Make workspace delete + conversation reassignment atomic
7. **[MEDIUM]** Auto-add new invited users to default workspace
8. **[LOW]** Use CSS variable for rail width instead of hardcoded value

---

## Metrics

- **Type Coverage:** Good -- all new interfaces properly typed, function signatures updated
- **Test Coverage:** N/A (no tests added)
- **Linting Issues:** 0 (build clean)
- **Security:** 1 critical (data leak via RPC), 1 medium (non-atomic delete)

---

## Unresolved Questions

1. Should `get_my_conversations` return `workspace_id` in its output? Currently relies on `row_to_json` implicitly including all columns -- this works but is fragile if the RPC is ever changed to explicit column selection.
2. Should there be a max workspace limit per deployment to prevent channel proliferation?
3. What happens to a user's active workspace selection if they are removed from that workspace by an admin? Currently they'd see an empty state until they switch.
