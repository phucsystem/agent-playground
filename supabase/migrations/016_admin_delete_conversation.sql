-- ============================================================
-- Feature: Allow admins to delete DM conversations
-- Deletes conversation, messages, attachments (via CASCADE),
-- and storage files via API route
-- ============================================================

-- Allow system admins to delete any conversation
CREATE POLICY "admin_conversations_delete" ON conversations FOR DELETE
  USING (is_admin());

-- Allow system admins to read any conversation (for delete flow)
CREATE POLICY "admin_conversations_select" ON conversations FOR SELECT
  USING (is_admin());

-- Allow system admins to read any attachments (to get storage paths for cleanup)
CREATE POLICY "admin_attachments_select" ON attachments FOR SELECT
  USING (is_admin());

-- Allow system admins to read any messages (needed for attachment lookup)
CREATE POLICY "admin_messages_select" ON messages FOR SELECT
  USING (is_admin());

-- Allow admin to delete storage objects for cleanup
CREATE POLICY "admin_attachments_storage_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'attachments'
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Enable realtime on conversations table for DELETE events
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
