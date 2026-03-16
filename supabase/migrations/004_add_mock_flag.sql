-- Add mock flag to users — mock users only visible to admin
ALTER TABLE users ADD COLUMN is_mock boolean NOT NULL DEFAULT false;

-- Update existing users_select policy to hide mock users from non-admins
DROP POLICY IF EXISTS "users_select" ON users;
CREATE POLICY "users_select" ON users FOR SELECT
  USING (
    is_active = true
    AND (is_mock = false OR is_admin())
  );
