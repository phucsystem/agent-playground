---
phase: 1
status: complete
priority: critical
effort: high
---

# Phase 1: Database & Migration

## Context

- [Brainstorm Report](../reports/brainstorm-260317-multi-workspace-support.md)
- [DB_DESIGN.md](../../docs/DB_DESIGN.md) — existing schema, RLS patterns, DEFINER helpers
- [API_SPEC.md](../../docs/API_SPEC.md) — existing RPC functions

## Overview

Create workspace tables, add workspace_id FK to conversations, update RLS policies & helper functions, backfill existing data to "Default" workspace.

## Key Insights

- All RLS helpers use `SECURITY DEFINER` pattern to prevent recursion — new workspace helpers must follow same pattern
- Existing `my_conversation_ids()` helper needs workspace awareness
- `find_or_create_dm` and `create_group` RPCs need workspace_id parameter
- Migration must be backward-compatible: existing data moves to Default workspace

## Requirements

**Functional:**
- New `workspaces` table with name, avatar_url, description, is_default flag
- New `workspace_members` join table (workspace_id, user_id)
- `conversations.workspace_id` FK (NOT NULL after backfill)
- Updated RLS: users only see conversations/users in their workspaces
- Updated RPCs: workspace-scoped DM creation, group creation, conversation listing

**Non-functional:**
- Zero data loss during migration
- All existing conversations assigned to Default workspace
- All active users added to Default workspace
- Backward-compatible: app works with single workspace

## Architecture

### New Tables

```sql
workspaces
├── id (uuid PK)
├── name (text NOT NULL)
├── avatar_url (text NULLABLE)
├── description (text NULLABLE)
├── is_default (boolean DEFAULT false)
├── created_by (uuid FK → users)
├── created_at (timestamptz)
└── updated_at (timestamptz)

workspace_members
├── workspace_id (uuid FK → workspaces) ─┐ composite PK
├── user_id (uuid FK → users) ────────────┘
└── joined_at (timestamptz)
```

### Modified Tables

```sql
conversations
├── ... existing columns ...
└── workspace_id (uuid FK → workspaces, NOT NULL)  ← NEW
```

### New SECURITY DEFINER Helpers

```sql
is_workspace_member(ws_id uuid) → boolean
my_workspace_ids() → uuid[]
workspace_member_ids(ws_id uuid) → uuid[]
```

### Updated RPC Functions

```sql
find_or_create_dm(other_user_id uuid, ws_id uuid) → uuid
create_group(group_name text, member_ids uuid[], ws_id uuid) → uuid
get_my_conversations() → already filtered by conversation membership + workspace
```

## Related Code Files

**Create:**
- `supabase/migrations/016_workspaces.sql`

**Modify:**
- `src/types/database.ts` — add Workspace, WorkspaceMember types, update Conversation

## Implementation Steps

### Step 1: Create migration file `016_workspaces.sql`

```sql
-- 1. Create workspaces table
CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  avatar_url text,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure only one default workspace
CREATE UNIQUE INDEX idx_workspaces_default ON workspaces (is_default) WHERE is_default = true;

-- 2. Create workspace_members table
CREATE TABLE workspace_members (
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_user_id ON workspace_members(user_id);

-- 3. Enable RLS
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- 4. SECURITY DEFINER helpers (prevent RLS recursion)
CREATE OR REPLACE FUNCTION is_workspace_member(ws_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION my_workspace_ids()
RETURNS uuid[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION workspace_member_ids(ws_id uuid)
RETURNS uuid[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT user_id FROM workspace_members
    WHERE workspace_id = ws_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RLS policies for workspaces
CREATE POLICY "workspaces_select" ON workspaces FOR SELECT
  USING (is_workspace_member(id) OR is_admin());

CREATE POLICY "workspaces_insert" ON workspaces FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "workspaces_update" ON workspaces FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "workspaces_delete" ON workspaces FOR DELETE
  USING (is_admin() AND is_default = false);

-- 6. RLS policies for workspace_members
CREATE POLICY "workspace_members_select" ON workspace_members FOR SELECT
  USING (is_workspace_member(workspace_id) OR is_admin());

CREATE POLICY "workspace_members_insert" ON workspace_members FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "workspace_members_delete" ON workspace_members FOR DELETE
  USING (is_admin());

-- 7. Add workspace_id to conversations (nullable first for backfill)
ALTER TABLE conversations ADD COLUMN workspace_id uuid REFERENCES workspaces(id);

-- 8. Create default workspace + backfill
DO $$
DECLARE
  default_ws_id uuid;
  admin_id uuid;
BEGIN
  -- Find admin user
  SELECT id INTO admin_id FROM users WHERE role = 'admin' LIMIT 1;

  -- Create default workspace
  INSERT INTO workspaces (name, description, is_default, created_by)
  VALUES ('Default', 'Default workspace', true, admin_id)
  RETURNING id INTO default_ws_id;

  -- Add all active users to default workspace
  INSERT INTO workspace_members (workspace_id, user_id)
  SELECT default_ws_id, id FROM users WHERE is_active = true;

  -- Backfill all conversations
  UPDATE conversations SET workspace_id = default_ws_id;
END $$;

-- 9. Make workspace_id NOT NULL after backfill
ALTER TABLE conversations ALTER COLUMN workspace_id SET NOT NULL;

-- 10. Add index for workspace_id on conversations
CREATE INDEX idx_conversations_workspace_id ON conversations(workspace_id);

-- 11. Update conversations RLS - add workspace check
DROP POLICY IF EXISTS "conversations_select" ON conversations;
CREATE POLICY "conversations_select" ON conversations FOR SELECT
  USING (
    id = ANY(SELECT conversation_id FROM my_conversation_ids())
    AND workspace_id = ANY(my_workspace_ids())
  );

DROP POLICY IF EXISTS "conversations_insert" ON conversations;
CREATE POLICY "conversations_insert" ON conversations FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND is_workspace_member(workspace_id)
  );

-- 12. Update find_or_create_dm to be workspace-scoped
CREATE OR REPLACE FUNCTION find_or_create_dm(other_user_id uuid, ws_id uuid)
RETURNS uuid AS $$
DECLARE
  existing_id uuid;
  new_id uuid;
BEGIN
  -- Check if DM already exists between these two users IN THIS WORKSPACE
  SELECT cm1.conversation_id INTO existing_id
  FROM conversation_members cm1
  JOIN conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
  JOIN conversations conv ON conv.id = cm1.conversation_id
  WHERE cm1.user_id = auth.uid()
    AND cm2.user_id = other_user_id
    AND conv.type = 'dm'
    AND conv.workspace_id = ws_id;

  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  -- Create new DM in this workspace
  INSERT INTO conversations (type, created_by, workspace_id)
  VALUES ('dm', auth.uid(), ws_id)
  RETURNING id INTO new_id;

  INSERT INTO conversation_members (conversation_id, user_id, role)
  VALUES
    (new_id, auth.uid(), 'admin'),
    (new_id, other_user_id, 'member');

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Update create_group to be workspace-scoped
CREATE OR REPLACE FUNCTION create_group(
  group_name text,
  member_ids uuid[],
  ws_id uuid
)
RETURNS uuid AS $$
DECLARE
  new_conv_id uuid;
  member_id uuid;
BEGIN
  -- Only admin can create groups
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can create groups';
  END IF;

  -- Create group conversation in workspace
  INSERT INTO conversations (type, name, created_by, workspace_id)
  VALUES ('group', group_name, auth.uid(), ws_id)
  RETURNING id INTO new_conv_id;

  -- Add creator as admin
  INSERT INTO conversation_members (conversation_id, user_id, role)
  VALUES (new_conv_id, auth.uid(), 'admin');

  -- Add selected members
  FOREACH member_id IN ARRAY member_ids
  LOOP
    IF member_id != auth.uid() THEN
      INSERT INTO conversation_members (conversation_id, user_id, role)
      VALUES (new_conv_id, member_id, 'member');
    END IF;
  END LOOP;

  RETURN new_conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Add workspaces to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE workspaces;
ALTER PUBLICATION supabase_realtime ADD TABLE workspace_members;
```

### Step 2: Update TypeScript types in `src/types/database.ts`

Add new interfaces:

```typescript
export interface Workspace {
  id: string;
  name: string;
  avatar_url: string | null;
  description: string | null;
  is_default: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  joined_at: string;
}
```

Update Conversation interface:
```typescript
export interface Conversation {
  // ... existing fields ...
  workspace_id: string;  // NEW
}
```

### Step 3: Run migration and verify

```bash
supabase db push
```

Verify:
- Default workspace exists with `is_default = true`
- All active users are in `workspace_members`
- All conversations have `workspace_id` set
- `workspace_id` is NOT NULL

## Todo List

- [x] Create `016_workspaces.sql` migration
- [x] Test migration on local Supabase
- [x] Update `src/types/database.ts`
- [x] Verify RLS policies work (test as admin + regular user)
- [x] Verify `find_or_create_dm` with workspace_id
- [x] Verify `create_group` with workspace_id
- [x] Run `supabase db push`

## Success Criteria

- [x] `workspaces` and `workspace_members` tables created with RLS
- [x] All existing data migrated to Default workspace
- [x] `conversations.workspace_id` is NOT NULL
- [x] RPC functions accept and use workspace_id
- [x] SECURITY DEFINER helpers work without recursion
- [x] Existing app still works (single default workspace)

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Migration fails mid-way | Wrap backfill in DO $$ block (transactional) |
| RLS recursion with new helpers | Follow existing DEFINER pattern exactly |
| Breaking existing find_or_create_dm | Old signature overloaded — keep backward compat or update all callers in Phase 2 |

## Security Considerations

- Workspace RLS prevents cross-workspace data leakage
- Admin can see all workspaces
- Cannot delete default workspace (RLS policy check)
- workspace_members only modifiable by admin
