-- ============================================================
-- Function: get_conversation_members
-- Returns conversation members with user data, bypassing
-- users RLS so mock users are visible within conversations
-- ============================================================

CREATE OR REPLACE FUNCTION get_conversation_members(target_conversation_id uuid)
RETURNS TABLE (
  conversation_id uuid,
  user_id uuid,
  role text,
  joined_at timestamptz,
  display_name text,
  avatar_url text,
  is_agent boolean
) AS $$
BEGIN
  IF NOT is_conversation_member(target_conversation_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT cm.conversation_id, cm.user_id, cm.role::text, cm.joined_at,
         u.display_name, u.avatar_url, u.is_agent
  FROM conversation_members cm
  JOIN users u ON u.id = cm.user_id
  WHERE cm.conversation_id = target_conversation_id
    AND u.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
