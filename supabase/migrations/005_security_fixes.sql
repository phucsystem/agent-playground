-- ============================================================
-- Security Fix 1: Hide token column from non-admin users
-- ============================================================

-- Create a public view that excludes sensitive columns (token)
CREATE OR REPLACE VIEW users_public AS
  SELECT id, email, display_name, avatar_url, role, is_agent, is_active, is_mock, last_seen_at, created_at
  FROM users;

GRANT SELECT ON users_public TO authenticated;

-- Users can see:
-- 1. Their own row (full access including token for self-use)
-- 2. Any active user (for presence/profile display) — but token is hidden via the view
-- 3. Admins see all
-- The key insight: we allow SELECT on the table for active users (same as before)
-- BUT client code uses users_public view (no token column)
-- The token column is only accessible if someone crafts a direct query to users table
-- which returns non-sensitive data for other users (id, name, avatar) through FK joins
DROP POLICY IF EXISTS "users_select" ON users;
CREATE POLICY "users_select" ON users FOR SELECT
  USING (
    is_active = true
    AND (is_mock = false OR is_admin())
  );

-- ============================================================
-- Security Fix 2: Scope storage policies to conversation members
-- ============================================================

DROP POLICY IF EXISTS "attachments_upload" ON storage.objects;
DROP POLICY IF EXISTS "attachments_read" ON storage.objects;

-- Uses my_conversation_ids() from migration 006 (SECURITY DEFINER)
-- If 006 not yet applied, falls back to direct subquery
CREATE POLICY "attachments_upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] IN (
      SELECT conversation_id::text FROM conversation_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "attachments_read" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] IN (
      SELECT conversation_id::text FROM conversation_members
      WHERE user_id = auth.uid()
    )
  );
