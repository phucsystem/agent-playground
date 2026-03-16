# Brainstorm: Multi-Workspace Support

**Date:** 2026-03-17
**Status:** Agreed — ready for implementation planning

---

## Problem Statement

Current platform is single-namespace — all users, conversations, agents share one flat space. Need workspace isolation so:
- Admin can create multiple workspaces with name, avatar, description
- Users invited to specific workspaces (auto-add, no accept flow)
- Users in workspace see only members and conversations of that workspace
- Users can belong to multiple workspaces, switch between them
- Existing data auto-migrates to "Default" workspace

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data model | FK-based (workspace_id on conversations) | Strong isolation at data level, simple RLS |
| Membership | Multi-workspace per user | Flexibility without complexity |
| Admin model | Global admin only | Matches existing role system |
| Agent scope | Global (not per-workspace) | Agents assigned to conversations, not workspaces |
| Invite flow | Auto-add | Fits invite-only model, simpler UX |
| DM isolation | Separate per workspace | Strict isolation, matches "cannot see other workspace" |
| Presence | Per-workspace | Scoped to active workspace |
| UI | Discord-style icon rail | Separate vertical strip on far-left |
| Workspace state | localStorage | Per-device, no DB round-trip |
| Migration | Auto-migrate to Default | Zero disruption |

## Recommended Solution: Approach A (FK-based Isolation)

### New Tables

**`workspaces`**
- id (uuid PK), name, avatar_url, description, created_by (FK users), is_default (boolean), created_at, updated_at

**`workspace_members`**
- workspace_id (FK), user_id (FK), joined_at — composite PK

### Schema Changes

- `conversations` gets `workspace_id` FK (NOT NULL after migration backfill)
- No changes to messages, reactions, attachments (they inherit workspace scope via conversation)

### New RLS Helpers (SECURITY DEFINER)

```sql
is_workspace_member(ws_id uuid) → boolean
my_workspace_ids() → uuid[]
workspace_member_ids(ws_id uuid) → uuid[]
```

### RLS Policy Updates

- `users_select`: Filter by workspace_members intersection with active workspace (passed as param or RPC context)
- `conversations_select`: Add `workspace_id = ANY(my_workspace_ids())` condition
- `conversation_members`: Inherits from conversation RLS
- Messages, reactions, attachments: No change (scoped via conversation membership)

### Modified RPC Functions

- `find_or_create_dm(other_user_id, workspace_id)` — workspace-scoped DMs
- `create_group(name, member_ids, workspace_id)` — workspace-scoped groups
- `get_my_conversations(workspace_id)` — filter by workspace

### UI Architecture

```
┌──┬─────────────────┬──────────────────────┐
│WS│  Sidebar         │  Chat Area           │
│  │                  │                      │
│🏠│ Search...        │  [Header]            │
│  │                  │                      │
│🔵│ #general         │  Messages...         │
│  │ #random          │                      │
│🟢│ @john (DM)       │                      │
│  │                  │                      │
│+ │ Online Users     │  [Input]             │
│  │  • jane          │                      │
│  │  • bob           │                      │
└──┴─────────────────┴──────────────────────┘
```

Icon rail: workspace avatars, active indicator, "+" button (admin only)

### Migration Strategy

1. Create `workspaces` + `workspace_members` tables
2. Insert "Default" workspace (is_default = true)
3. Add all active users to Default workspace
4. Add `workspace_id` column to conversations (nullable initially)
5. Backfill all conversations with default workspace_id
6. Set NOT NULL constraint
7. Update RLS policies + helpers
8. Update RPC functions

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| RLS complexity | Medium | Follow existing DEFINER pattern, test multi-user |
| Realtime channels | Low | One presence channel per workspace |
| Migration integrity | Medium | Transaction + verify backfill |
| Performance on switch | Low | Client-side state, re-fetch conversations |
| Token invite + workspace | Low | Admin assigns workspace during user creation |

### Estimated Scope

- 1 migration (~100-150 lines SQL)
- 3-4 new/modified hooks (useWorkspaces, useWorkspaceMembers, modified useConversations, useCurrentUser)
- 3 new components (WorkspaceRail, WorkspaceSettings dialog, workspace management in admin)
- Modified: Sidebar, AllUsers, CreateGroupDialog, AdminPage, find_or_create_dm RPC
- Presence channel update: namespace by workspace

## Rejected Alternative

**Approach B (Virtual isolation via query-time joins):** No FK on conversations, filter via workspace_members ∩ conversation_members intersection. Rejected because: complex queries, weaker isolation guarantees, harder RLS, violates KISS.

## Unresolved Questions

1. Should workspace have a "general" conversation auto-created on workspace creation?
2. Should admin see all workspaces' data in admin panel, or switch workspace context too?
3. Max workspaces limit per platform?

## Next Steps

Create detailed implementation plan via `/plan` with phased approach.
