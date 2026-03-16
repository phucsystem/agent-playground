-- Multi-workspace support: tables, RLS, helpers, backfill

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
  IF NOT is_workspace_member(ws_id) AND NOT is_admin() THEN
    RETURN ARRAY[]::uuid[];
  END IF;
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
  SELECT id INTO admin_id FROM users WHERE role = 'admin' LIMIT 1;

  INSERT INTO workspaces (name, description, is_default, created_by)
  VALUES ('Default', 'Default workspace', true, admin_id)
  RETURNING id INTO default_ws_id;

  INSERT INTO workspace_members (workspace_id, user_id)
  SELECT default_ws_id, id FROM users WHERE is_active = true;

  UPDATE conversations SET workspace_id = default_ws_id;
END $$;

-- 9. Make workspace_id NOT NULL after backfill
ALTER TABLE conversations ALTER COLUMN workspace_id SET NOT NULL;

-- 10. Index for workspace_id on conversations
CREATE INDEX idx_conversations_workspace_id ON conversations(workspace_id);

-- 11. Update conversations RLS - add workspace check
DROP POLICY IF EXISTS "conversations_select" ON conversations;
CREATE POLICY "conversations_select" ON conversations FOR SELECT
  USING (
    id = ANY(my_conversation_ids())
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
  -- Validate both users are members of the workspace
  IF NOT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id = ws_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Caller is not a member of this workspace';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id = ws_id AND user_id = other_user_id) THEN
    RAISE EXCEPTION 'Target user is not a member of this workspace';
  END IF;

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
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can create groups';
  END IF;

  INSERT INTO conversations (type, name, created_by, workspace_id)
  VALUES ('group', group_name, auth.uid(), ws_id)
  RETURNING id INTO new_conv_id;

  INSERT INTO conversation_members (conversation_id, user_id, role)
  VALUES (new_conv_id, auth.uid(), 'admin');

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

-- 14. Update get_my_conversations to accept workspace filter
CREATE OR REPLACE FUNCTION get_my_conversations(ws_id uuid DEFAULT NULL)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(conv_data))
  INTO result
  FROM (
    SELECT
      conv.id,
      conv.type,
      conv.name,
      conv.updated_at,
      conv.is_archived,
      conv.workspace_id,
      CASE
        WHEN conv.type = 'dm' THEN (
          SELECT json_build_object(
            'id', other_user.id,
            'display_name', other_user.display_name,
            'avatar_url', other_user.avatar_url,
            'is_agent', other_user.is_agent
          )
          FROM conversation_members other_cm
          JOIN users other_user ON other_user.id = other_cm.user_id
          WHERE other_cm.conversation_id = conv.id
            AND other_cm.user_id != auth.uid()
          LIMIT 1
        )
        ELSE NULL
      END AS other_user,
      CASE
        WHEN conv.type = 'group' THEN (
          SELECT COUNT(*) FROM conversation_members
          WHERE conversation_id = conv.id
        )
        ELSE NULL
      END AS member_count,
      (
        SELECT json_build_object(
          'content', last_msg.content,
          'sender_name', sender.display_name,
          'created_at', last_msg.created_at
        )
        FROM messages last_msg
        JOIN users sender ON sender.id = last_msg.sender_id
        WHERE last_msg.conversation_id = conv.id
        ORDER BY last_msg.created_at DESC
        LIMIT 1
      ) AS last_message,
      COALESCE((
        SELECT COUNT(*)
        FROM messages unread_msg
        WHERE unread_msg.conversation_id = conv.id
          AND unread_msg.created_at > COALESCE(my_cm.last_read_at, '1970-01-01'::timestamptz)
          AND unread_msg.sender_id != auth.uid()
      ), 0) AS unread_count
    FROM conversations conv
    JOIN conversation_members my_cm ON my_cm.conversation_id = conv.id AND my_cm.user_id = auth.uid()
    WHERE (ws_id IS NULL OR conv.workspace_id = ws_id)
    ORDER BY conv.updated_at DESC
  ) conv_data;

  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. Add workspaces to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE workspaces;
ALTER PUBLICATION supabase_realtime ADD TABLE workspace_members;
