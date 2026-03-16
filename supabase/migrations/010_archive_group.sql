-- ============================================================
-- Feature: Archive groups
-- Members can still read but cannot send messages
-- ============================================================

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- Update messages insert policy to block sending to archived conversations
DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND is_conversation_member(conversation_id)
    AND NOT EXISTS (
      SELECT 1 FROM conversations
      WHERE id = conversation_id AND is_archived = true
    )
  );

-- Allow group admins to archive/unarchive
DROP POLICY IF EXISTS "conversations_update" ON conversations;
CREATE POLICY "conversations_update" ON conversations FOR UPDATE
  USING (id IN (SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (id IN (SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid() AND role = 'admin'));

-- Update get_my_conversations to include is_archived
CREATE OR REPLACE FUNCTION get_my_conversations()
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
    ORDER BY conv.updated_at DESC
  ) conv_data;

  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
