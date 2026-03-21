# Phase 01: Database Schema

**Priority:** Critical (blocks all other phases)
**Status:** ⏳
**Effort:** S

## Context

- Current messages table: `id, conversation_id, sender_id, content, content_type, metadata, created_at`
- No UPDATE or DELETE RLS policies exist — only SELECT and INSERT
- Realtime publication already includes messages table
- 20 migrations exist (001-020)

## Requirements

- FR-EDIT: Users can edit their own messages
- FR-DELETE: Users can soft-delete their own messages
- FR-AUDIT: Admins can view original content of edited/deleted messages
- FR-RETENTION: Workspace-level message retention setting

## Migration: 021_message_management.sql

### New Columns on `messages`

```sql
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
```

### New Column on `workspaces`

```sql
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS message_retention_days integer;
```

### RLS Policies

```sql
-- Users can update their own messages (edit content)
CREATE POLICY "messages_update_own" ON messages FOR UPDATE
  USING (auth.uid() = sender_id AND is_conversation_member(conversation_id))
  WITH CHECK (auth.uid() = sender_id AND is_conversation_member(conversation_id));

-- Conversation admins can update messages (for soft-delete by admin)
CREATE POLICY "messages_update_conv_admin" ON messages FOR UPDATE
  USING (is_conversation_admin(conversation_id))
  WITH CHECK (is_conversation_admin(conversation_id));

-- Global admins can update any message
CREATE POLICY "messages_update_admin" ON messages FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());
```

### RPC Functions

```sql
-- Edit a message (sender only)
CREATE OR REPLACE FUNCTION edit_message(msg_id uuid, new_content text)
RETURNS void AS $$
DECLARE
  old_content text;
  old_metadata jsonb;
  edit_history jsonb;
BEGIN
  -- Get current content and metadata
  SELECT content, COALESCE(metadata, '{}'::jsonb)
  INTO old_content, old_metadata
  FROM messages
  WHERE id = msg_id AND sender_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found or not authorized';
  END IF;

  -- Build edit history (keep last 5)
  edit_history := COALESCE(old_metadata->'edit_history', '[]'::jsonb);
  edit_history := edit_history || jsonb_build_object(
    'content', old_content,
    'edited_at', now()
  );
  -- Trim to last 5 entries
  IF jsonb_array_length(edit_history) > 5 THEN
    edit_history := (SELECT jsonb_agg(value) FROM jsonb_array_elements(edit_history) WITH ORDINALITY WHERE ordinality > jsonb_array_length(edit_history) - 5);
  END IF;

  old_metadata := jsonb_set(old_metadata, '{edit_history}', edit_history);

  UPDATE messages
  SET content = new_content,
      edited_at = now(),
      metadata = old_metadata
  WHERE id = msg_id AND sender_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Soft delete a message (sender or conversation admin)
CREATE OR REPLACE FUNCTION delete_message(msg_id uuid)
RETURNS void AS $$
DECLARE
  msg_record RECORD;
BEGIN
  SELECT id, sender_id, conversation_id
  INTO msg_record
  FROM messages
  WHERE id = msg_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  -- Check authorization: sender, conversation admin, or global admin
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
        'original_content', content
      ),
      content = ''
  WHERE id = msg_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Update get_unread_counts to exclude deleted

```sql
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
```

### Index

```sql
CREATE INDEX IF NOT EXISTS idx_messages_is_deleted ON messages (conversation_id, is_deleted) WHERE is_deleted = true;
```

## Implementation Steps

- [ ] Create migration file `supabase/migrations/021_message_management.sql`
- [ ] Add `edited_at` and `is_deleted` columns to messages
- [ ] Add `message_retention_days` to workspaces
- [ ] Create UPDATE RLS policies for messages
- [ ] Create `edit_message()` RPC function
- [ ] Create `delete_message()` RPC function
- [ ] Update `get_unread_counts()` to exclude deleted messages
- [ ] Add partial index for deleted messages
- [ ] Update `src/types/database.ts` with new fields

## Success Criteria

- Migration runs without errors on existing data
- edit_message() preserves history in metadata.edit_history
- delete_message() soft-deletes and stores original content
- Unread counts exclude deleted messages
- RLS prevents unauthorized edits/deletes
