-- ============================================================
-- Function: create_group
-- Atomically creates a group conversation + adds members
-- Bypasses the SELECT RLS chicken-and-egg problem
-- ============================================================

CREATE OR REPLACE FUNCTION create_group(
  group_name text,
  member_ids uuid[]
)
RETURNS uuid AS $$
DECLARE
  new_conversation_id uuid;
  member_id uuid;
BEGIN
  INSERT INTO conversations (type, name, created_by)
  VALUES ('group', group_name, auth.uid())
  RETURNING id INTO new_conversation_id;

  INSERT INTO conversation_members (conversation_id, user_id, role)
  VALUES (new_conversation_id, auth.uid(), 'admin');

  FOREACH member_id IN ARRAY member_ids
  LOOP
    IF member_id != auth.uid() THEN
      INSERT INTO conversation_members (conversation_id, user_id, role)
      VALUES (new_conversation_id, member_id, 'member');
    END IF;
  END LOOP;

  RETURN new_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
