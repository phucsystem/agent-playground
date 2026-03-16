-- Add notification preference to users table
ALTER TABLE users ADD COLUMN notification_enabled boolean NOT NULL DEFAULT true;

-- Update users_public view to include new column
CREATE OR REPLACE VIEW users_public AS
  SELECT id, email, display_name, avatar_url, role, is_agent, is_active, is_mock, last_seen_at, created_at, notification_enabled
  FROM users;

GRANT SELECT ON users_public TO authenticated;
