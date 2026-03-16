-- Helper function to check admin role without triggering RLS recursion
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Allow admin users to insert new users
CREATE POLICY "admin_users_insert" ON users FOR INSERT
  WITH CHECK (is_admin());

-- Allow admin users to update any user
CREATE POLICY "admin_users_update" ON users FOR UPDATE
  USING (is_admin());

-- Allow admin users to delete non-admin users
CREATE POLICY "admin_users_delete" ON users FOR DELETE
  USING (is_admin() AND role != 'admin');

-- Allow admin to read all users (including inactive)
CREATE POLICY "admin_users_select_all" ON users FOR SELECT
  USING (is_admin());
