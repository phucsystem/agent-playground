-- ============================================================
-- Agent Playground - Initial Schema
-- ============================================================

-- Custom types
CREATE TYPE conversation_type AS ENUM ('dm', 'group');
CREATE TYPE member_role AS ENUM ('admin', 'member');
CREATE TYPE content_type AS ENUM ('text', 'file', 'image', 'url');

-- ============================================================
-- E-01: users
-- ============================================================
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  is_agent boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  token text UNIQUE NOT NULL,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_token ON users (token);
CREATE INDEX idx_users_is_active ON users (is_active);

-- ============================================================
-- E-02: conversations
-- ============================================================
CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type conversation_type NOT NULL,
  name text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_updated_at ON conversations (updated_at DESC);
CREATE INDEX idx_conversations_created_by ON conversations (created_by);

-- ============================================================
-- E-03: conversation_members
-- ============================================================
CREATE TABLE conversation_members (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX idx_members_user_id ON conversation_members (user_id);

-- ============================================================
-- E-04: messages
-- ============================================================
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id),
  content text NOT NULL,
  content_type content_type NOT NULL DEFAULT 'text',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation_created ON messages (conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender_id ON messages (sender_id);

-- ============================================================
-- E-05: attachments
-- ============================================================
CREATE TABLE attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_attachments_message_id ON attachments (message_id);

-- ============================================================
-- E-06: reactions (Phase 3)
-- ============================================================
CREATE TABLE reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX idx_reactions_message_id ON reactions (message_id);

-- ============================================================
-- Trigger: update conversation.updated_at on new message
-- ============================================================
CREATE OR REPLACE FUNCTION update_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_messages_update_conversation
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_updated_at();

-- ============================================================
-- RLS: Enable on all tables
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies: users
-- ============================================================
CREATE POLICY "users_select" ON users FOR SELECT
  USING (is_active = true);

CREATE POLICY "users_update_self" ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- RLS Policies: conversations
-- ============================================================
CREATE POLICY "conversations_select" ON conversations FOR SELECT
  USING (id IN (
    SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "conversations_insert" ON conversations FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- ============================================================
-- RLS Policies: conversation_members
-- ============================================================
CREATE POLICY "members_select" ON conversation_members FOR SELECT
  USING (conversation_id IN (
    SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "members_insert" ON conversation_members FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT conversation_id FROM conversation_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "members_delete" ON conversation_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR conversation_id IN (
      SELECT conversation_id FROM conversation_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- RLS Policies: messages
-- ============================================================
CREATE POLICY "messages_select" ON messages FOR SELECT
  USING (conversation_id IN (
    SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "messages_insert" ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND conversation_id IN (
      SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- RLS Policies: attachments
-- ============================================================
CREATE POLICY "attachments_select" ON attachments FOR SELECT
  USING (message_id IN (
    SELECT id FROM messages WHERE conversation_id IN (
      SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "attachments_insert" ON attachments FOR INSERT
  WITH CHECK (message_id IN (
    SELECT id FROM messages WHERE sender_id = auth.uid()
  ));

-- ============================================================
-- RLS Policies: reactions
-- ============================================================
CREATE POLICY "reactions_select" ON reactions FOR SELECT
  USING (message_id IN (
    SELECT id FROM messages WHERE conversation_id IN (
      SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "reactions_insert" ON reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reactions_delete" ON reactions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- Database Functions
-- ============================================================

-- Find or create DM conversation
CREATE OR REPLACE FUNCTION find_or_create_dm(other_user_id uuid)
RETURNS uuid AS $$
DECLARE
  existing_id uuid;
  new_id uuid;
BEGIN
  SELECT cm1.conversation_id INTO existing_id
  FROM conversation_members cm1
  JOIN conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
  JOIN conversations conv ON conv.id = cm1.conversation_id
  WHERE cm1.user_id = auth.uid()
    AND cm2.user_id = other_user_id
    AND conv.type = 'dm';

  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  INSERT INTO conversations (type, created_by)
  VALUES ('dm', auth.uid())
  RETURNING id INTO new_id;

  INSERT INTO conversation_members (conversation_id, user_id, role)
  VALUES
    (new_id, auth.uid(), 'admin'),
    (new_id, other_user_id, 'member');

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get unread counts per conversation
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
  WHERE cm.user_id = auth.uid()
  GROUP BY cm.conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark conversation as read
CREATE OR REPLACE FUNCTION mark_conversation_read(conv_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE conversation_members
  SET last_read_at = now()
  WHERE conversation_id = conv_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get my conversations with details
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

-- ============================================================
-- Realtime: enable on messages and reactions
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE reactions;

-- ============================================================
-- Storage: create attachments bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "attachments_upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'attachments'
  );

CREATE POLICY "attachments_read" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'attachments'
  );
