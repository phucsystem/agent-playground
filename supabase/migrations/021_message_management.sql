-- 021_message_management.sql
-- Message edit, soft-delete, and admin audit support

-- 1. Add columns to messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- 2. Add retention setting to workspaces
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS message_retention_days integer;

-- 3. Partial index for deleted messages (fast filter)
CREATE INDEX IF NOT EXISTS idx_messages_is_deleted
  ON messages (conversation_id, is_deleted) WHERE is_deleted = true;

-- 4. RLS policies for message UPDATE
-- Sender can edit their own messages
CREATE POLICY "messages_update_own" ON messages FOR UPDATE
  USING (auth.uid() = sender_id AND is_conversation_member(conversation_id))
  WITH CHECK (auth.uid() = sender_id AND is_conversation_member(conversation_id));

-- Conversation admins can update messages (soft-delete)
CREATE POLICY "messages_update_conv_admin" ON messages FOR UPDATE
  USING (is_conversation_admin(conversation_id))
  WITH CHECK (is_conversation_admin(conversation_id));

-- Global admins can update any message
CREATE POLICY "messages_update_admin" ON messages FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- 5. Edit message RPC (sender only)
CREATE OR REPLACE FUNCTION edit_message(msg_id uuid, new_content text)
RETURNS void AS $$
DECLARE
  old_content text;
  old_metadata jsonb;
  old_is_deleted boolean;
  edit_history jsonb;
BEGIN
  IF TRIM(new_content) = '' THEN
    RAISE EXCEPTION 'Message content cannot be empty';
  END IF;

  SELECT content, COALESCE(metadata, '{}'::jsonb), is_deleted
  INTO old_content, old_metadata, old_is_deleted
  FROM messages
  WHERE id = msg_id AND sender_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found or not authorized';
  END IF;

  IF old_is_deleted THEN
    RAISE EXCEPTION 'Cannot edit a deleted message';
  END IF;

  edit_history := COALESCE(old_metadata->'edit_history', '[]'::jsonb);
  edit_history := edit_history || jsonb_build_object(
    'content', old_content,
    'edited_at', now()
  );

  IF jsonb_array_length(edit_history) > 5 THEN
    edit_history := (
      SELECT jsonb_agg(value)
      FROM jsonb_array_elements(edit_history) WITH ORDINALITY
      WHERE ordinality > jsonb_array_length(edit_history) - 5
    );
  END IF;

  old_metadata := jsonb_set(old_metadata, '{edit_history}', edit_history);

  UPDATE messages
  SET content = new_content,
      edited_at = now(),
      metadata = old_metadata
  WHERE id = msg_id AND sender_id = auth.uid() AND is_deleted = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Soft delete message RPC (sender, conv admin, or global admin)
CREATE OR REPLACE FUNCTION delete_message(msg_id uuid)
RETURNS void AS $$
DECLARE
  msg_record RECORD;
BEGIN
  SELECT id, sender_id, conversation_id, content, is_deleted
  INTO msg_record
  FROM messages
  WHERE id = msg_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  IF msg_record.is_deleted THEN
    RETURN;
  END IF;

  IF msg_record.sender_id != auth.uid()
    AND NOT is_conversation_admin(msg_record.conversation_id)
    AND NOT is_admin()
  THEN
    RAISE EXCEPTION 'Not authorized to delete this message';
  END IF;

  UPDATE messages
  SET is_deleted = true,
      edited_at = now(),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'deleted_by', auth.uid(),
        'deleted_at', now(),
        'original_content', msg_record.content
      ),
      content = ''
  WHERE id = msg_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Admin-only function to retrieve deleted message original content
-- Prevents non-admin members from reading original_content via metadata in SELECT
CREATE OR REPLACE FUNCTION get_message_audit(msg_id uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT jsonb_build_object(
    'original_content', metadata->'original_content',
    'deleted_by', metadata->'deleted_by',
    'deleted_at', metadata->'deleted_at',
    'edit_history', metadata->'edit_history'
  ) INTO result
  FROM messages
  WHERE id = msg_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Update get_my_conversations to exclude deleted messages from last_message and unread_count
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
          AND last_msg.is_deleted = false
        ORDER BY last_msg.created_at DESC
        LIMIT 1
      ) AS last_message,
      COALESCE((
        SELECT COUNT(*)
        FROM messages unread_msg
        WHERE unread_msg.conversation_id = conv.id
          AND unread_msg.created_at > COALESCE(my_cm.last_read_at, '1970-01-01'::timestamptz)
          AND unread_msg.sender_id != auth.uid()
          AND unread_msg.is_deleted = false
      ), 0) AS unread_count
    FROM conversations conv
    JOIN conversation_members my_cm ON my_cm.conversation_id = conv.id AND my_cm.user_id = auth.uid()
    WHERE (ws_id IS NULL OR conv.workspace_id = ws_id)
    ORDER BY conv.updated_at DESC
  ) conv_data;

  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Update get_unread_counts to exclude deleted messages
CREATE OR REPLACE FUNCTION get_unread_counts()
RETURNS TABLE(conversation_id uuid, unread_count bigint) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.conversation_id,
    COUNT(msg.id) AS unread_count
  FROM conversation_members cm
  LEFT JOIN messages msg ON msg.conversation_id = cm.conversation_id
    AND msg.created_at > COALESCE(cm.last_read_at, '1970-01-01'::timestamptz)
    AND msg.sender_id != auth.uid()
    AND msg.is_deleted = false
  WHERE cm.user_id = auth.uid()
  GROUP BY cm.conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
