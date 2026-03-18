-- ============================================================
-- Read Receipts: extend get_conversation_members with last_read_at
-- and enable realtime on conversation_members
-- ============================================================

-- Update get_conversation_members to include last_read_at
CREATE OR REPLACE FUNCTION get_conversation_members(target_conversation_id uuid)
RETURNS TABLE (
  conversation_id uuid,
  user_id uuid,
  role text,
  joined_at timestamptz,
  display_name text,
  avatar_url text,
  is_agent boolean,
  last_read_at timestamptz
) AS $$
BEGIN
  IF NOT is_conversation_member(target_conversation_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT cm.conversation_id, cm.user_id, cm.role::text, cm.joined_at,
         u.display_name, u.avatar_url, u.is_agent, cm.last_read_at
  FROM conversation_members cm
  JOIN users u ON u.id = cm.user_id
  WHERE cm.conversation_id = target_conversation_id
    AND u.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Enable realtime on conversation_members for last_read_at updates
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_members;

-- Allow members to update their own last_read_at
CREATE POLICY "members_update_own_read" ON conversation_members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Protect role/joined_at from direct UPDATE (only last_read_at allowed)
CREATE OR REPLACE FUNCTION protect_member_columns()
RETURNS TRIGGER AS $$
BEGIN
  NEW.role := OLD.role;
  NEW.joined_at := OLD.joined_at;
  NEW.conversation_id := OLD.conversation_id;
  NEW.user_id := OLD.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_member_columns
  BEFORE UPDATE ON conversation_members
  FOR EACH ROW
  EXECUTE FUNCTION protect_member_columns();
