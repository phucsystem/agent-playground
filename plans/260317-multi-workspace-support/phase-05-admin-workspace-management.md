---
phase: 5
status: complete
priority: medium
effort: medium
---

# Phase 5: Admin Workspace Management

## Context

- [Phase 1: Database](./phase-01-database-migration.md) — workspace tables exist
- [Phase 3: Rail UI](./phase-03-workspace-rail-ui.md) — workspace creation dialog exists
- Admin page at `src/app/admin/page.tsx` (673 LOC)

## Overview

Extend admin page with workspace management: edit workspace settings (name, avatar, description), manage workspace members (add/remove users), and invite new users directly into a workspace.

## Key Insights

- Admin page is already large (673 LOC) — workspace management should be separate section or tab
- Current user creation flow: admin generates token → user logs in → setup wizard
- For workspaces: admin creates user token AND assigns to workspace in same flow
- Workspace settings: name, avatar (DiceBear URL), description — simple edit form
- Member management: add existing users, remove members

## Related Code Files

**Create:**
- `src/components/admin/workspace-settings.tsx` — edit workspace name/avatar/desc
- `src/components/admin/workspace-members.tsx` — add/remove members

**Modify:**
- `src/app/admin/page.tsx` — add workspace management section/tab
- Token generation flow — add workspace assignment

## Implementation Steps

### Step 1: Add workspace management section to admin page

Add a "Workspaces" tab/section alongside existing "Users" section:

```
┌─────────────────────────────────────────────────────┐
│ Agent Playground — Admin                            │
├─────────────────────────────────────────────────────┤
│ [Users] [Workspaces]                                │  ← tabs
├─────────────────────────────────────────────────────┤
│                                                     │
│ Workspaces (3)                   [+ Create]         │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Name      │ Members │ Default │ Actions        │ │ │
│ ├─────────────────────────────────────────────────┤ │
│ │ Default   │ 12      │ ✓       │ Edit │ Members│ │ │
│ │ Team A    │ 5       │         │ Edit │ Members│ │ │
│ │ Team B    │ 3       │         │ Edit │ Members│ Delete │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Step 2: Create workspace settings dialog (`workspace-settings.tsx`)

Edit dialog for workspace:
- Name input (required)
- Description textarea (optional)
- Avatar URL input or DiceBear style picker
- Save button

```typescript
// On save:
await supabase.from("workspaces")
  .update({ name, description, avatar_url })
  .eq("id", workspaceId);
```

### Step 3: Create workspace members management (`workspace-members.tsx`)

Member management panel:
- List current members with remove button
- "Add member" dropdown — shows users NOT in this workspace
- Remove confirms before deletion

```typescript
// Add member:
await supabase.from("workspace_members")
  .insert({ workspace_id: wsId, user_id: userId });

// Remove member:
await supabase.from("workspace_members")
  .delete()
  .eq("workspace_id", wsId)
  .eq("user_id", userId);
```

### Step 4: Update token generation to include workspace

When admin generates a new user token:
1. Existing flow: generate token, create user
2. New: add workspace selector dropdown
3. After user creation: auto-add to selected workspace(s)

```typescript
// After creating user:
await supabase.from("workspace_members").insert(
  selectedWorkspaces.map((wsId) => ({
    workspace_id: wsId,
    user_id: newUser.id,
  }))
);
```

### Step 5: Workspace deletion

- Cannot delete default workspace (enforced by RLS + UI)
- Delete workspace → CASCADE deletes workspace_members
- Conversations in workspace: decide policy
  - Option A: Delete conversations too (CASCADE) — destructive
  - Option B: Move to default workspace — safer
  - **Recommendation: Option B** — move conversations to default workspace before delete

```typescript
// Move conversations to default, then delete workspace
const { data: defaultWs } = await supabase
  .from("workspaces")
  .select("id")
  .eq("is_default", true)
  .single();

await supabase.from("conversations")
  .update({ workspace_id: defaultWs.id })
  .eq("workspace_id", deletingWsId);

await supabase.from("workspaces")
  .delete()
  .eq("id", deletingWsId);
```

## Todo List

- [x] Add workspace tab/section to admin page
- [x] Create `workspace-settings.tsx` — edit dialog
- [x] Create `workspace-members.tsx` — member management
- [x] Update token generation — workspace assignment
- [x] Handle workspace deletion (move conversations to default)
- [x] Test: create workspace, add members, edit settings
- [x] Test: remove member from workspace
- [x] Test: delete workspace (conversations move to default)
- [x] Compile check: `pnpm build` passes

## Success Criteria

- [x] Admin can create, edit, delete workspaces
- [x] Admin can add/remove users from workspaces
- [x] New user creation includes workspace assignment
- [x] Default workspace cannot be deleted
- [x] Workspace deletion moves conversations to default
- [x] No orphaned data after workspace operations
