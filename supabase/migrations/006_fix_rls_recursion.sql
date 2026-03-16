-- ============================================================
-- Fix RLS recursion: conversation_members self-referencing
-- All policies that check membership now use SECURITY DEFINER helpers
-- ============================================================

-- Helper: get conversation IDs the current user is a member of
CREATE OR REPLACE FUNCTION my_conversation_ids()
RETURNS SETOF uuid AS $$
  SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if current user is member of a specific conversation
CREATE OR REPLACE FUNCTION is_conversation_member(conv_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = conv_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if current user is admin of a specific conversation
CREATE OR REPLACE FUNCTION is_conversation_admin(conv_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = conv_id AND user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Fix: conversation_members policies
-- ============================================================
DROP POLICY IF EXISTS "members_select" ON conversation_members;
CREATE POLICY "members_select" ON conversation_members FOR SELECT
  USING (is_conversation_member(conversation_id));

DROP POLICY IF EXISTS "members_insert" ON conversation_members;
CREATE POLICY "members_insert" ON conversation_members FOR INSERT
  WITH CHECK (is_conversation_admin(conversation_id));

DROP POLICY IF EXISTS "members_delete" ON conversation_members;
CREATE POLICY "members_delete" ON conversation_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR is_conversation_admin(conversation_id)
  );

-- ============================================================
-- Fix: conversations policies
-- ============================================================
DROP POLICY IF EXISTS "conversations_select" ON conversations;
CREATE POLICY "conversations_select" ON conversations FOR SELECT
  USING (id IN (SELECT my_conversation_ids()));

-- ============================================================
-- Fix: messages policies
-- ============================================================
DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages FOR SELECT
  USING (conversation_id IN (SELECT my_conversation_ids()));

DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND is_conversation_member(conversation_id)
  );

-- ============================================================
-- Fix: attachments policies
-- ============================================================
DROP POLICY IF EXISTS "attachments_select" ON attachments;
CREATE POLICY "attachments_select" ON attachments FOR SELECT
  USING (message_id IN (
    SELECT id FROM messages WHERE conversation_id IN (SELECT my_conversation_ids())
  ));

DROP POLICY IF EXISTS "attachments_insert" ON attachments;
CREATE POLICY "attachments_insert" ON attachments FOR INSERT
  WITH CHECK (message_id IN (
    SELECT id FROM messages WHERE sender_id = auth.uid()
  ));

-- ============================================================
-- Fix: reactions policies
-- ============================================================
DROP POLICY IF EXISTS "reactions_select" ON reactions;
CREATE POLICY "reactions_select" ON reactions FOR SELECT
  USING (message_id IN (
    SELECT id FROM messages WHERE conversation_id IN (SELECT my_conversation_ids())
  ));
