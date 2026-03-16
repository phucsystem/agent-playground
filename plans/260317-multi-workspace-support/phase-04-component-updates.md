---
phase: 4
status: complete
priority: high
effort: medium
---

# Phase 4: Component Updates

## Context

- [Phase 2: Core Hooks](./phase-02-core-hooks-context.md) — WorkspaceProvider + updated hooks available
- [Codebase Summary](../../docs/codebase-summary.md) — component architecture

## Overview

Update existing sidebar components and chat components to use workspace context. Filter users by workspace, update group creation, ensure conversation navigation works within workspace scope.

## Key Insights

- `AllUsers` fetches from `users_public` — needs workspace_members join
- `CreateGroupDialog` fetches all active users — needs workspace filter
- `ConversationList` receives conversations from parent — already filtered in Phase 2
- Chat header shows user info — no change needed (user data is global)
- `find_or_create_dm` already updated in Phase 1 — just pass workspace_id from context

## Related Code Files

**Modify:**
- `src/components/sidebar/all-users.tsx` — filter users by workspace
- `src/components/sidebar/create-group-dialog.tsx` — workspace-aware group creation
- `src/components/sidebar/sidebar.tsx` — pass workspace context to children
- `src/components/sidebar/online-users.tsx` — filter by workspace presence
- `src/hooks/use-conversation-members.ts` — no change needed (scoped by conversation)

## Implementation Steps

### Step 1: Update `all-users.tsx`

Change user query to join through `workspace_members`:

```typescript
// Before:
const { data } = await supabase
  .from("users_public")
  .select("*")
  .eq("is_active", true)
  .neq("id", currentUserId);

// After:
const { data } = await supabase
  .from("workspace_members")
  .select("user:users!inner(id, display_name, avatar_url, is_agent, last_seen_at, role)")
  .eq("workspace_id", workspaceId)
  .neq("user_id", currentUserId);
// Then flatten: data.map(row => row.user)
```

Accept `workspaceId` as prop or from context.

### Step 2: Update `create-group-dialog.tsx`

- Fetch users from workspace (same query as Step 1)
- Pass workspace_id to `create_group` RPC:

```typescript
const { data } = await supabase.rpc("create_group", {
  group_name: groupName,
  member_ids: selectedMemberIds,
  ws_id: activeWorkspace.id,
});
```

### Step 3: Update `sidebar.tsx`

- Get `activeWorkspace` from `useWorkspaceContext()`
- Pass `workspaceId` to `AllUsers` and `CreateGroupDialog`
- Update `handleStartDM` to include workspace_id (already outlined in Phase 2)

### Step 4: Update `online-users.tsx`

- Presence data already scoped by workspace (from Phase 2 hook update)
- Component receives `onlineUserIds` from parent — no change to component itself
- But verify: if component fetches its own user data, add workspace filter

### Step 5: Update pinned conversations

`use-pinned-conversations.ts` uses localStorage key `pinned_conversations_{userId}`.
Update to `pinned_conversations_{userId}_{workspaceId}` so pins are per-workspace.

## Todo List

- [x] Update `all-users.tsx` — workspace-filtered user query
- [x] Update `create-group-dialog.tsx` — workspace-aware group creation
- [x] Update `sidebar.tsx` — pass workspace context
- [x] Update `online-users.tsx` — verify workspace scoping
- [x] Update `use-pinned-conversations.ts` — per-workspace pin storage
- [x] Test: users list shows only workspace members
- [x] Test: creating DM scopes to workspace
- [x] Test: creating group scopes to workspace
- [x] Compile check: `pnpm build` passes

## Success Criteria

- [x] AllUsers shows only members of active workspace
- [x] CreateGroupDialog only lists workspace members as options
- [x] DMs created within workspace context
- [x] Groups created within workspace context
- [x] Pinned conversations are per-workspace
- [x] Online presence shows only workspace members
