-- Add platform-level role to users (idempotent - type and column may exist from 001)
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'user', 'agent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'user';

-- Set agents to 'agent' role
UPDATE users SET role = 'agent' WHERE is_agent = true;

-- Set initial admin (created_at is earliest non-agent user)
UPDATE users SET role = 'admin'
  WHERE id = (SELECT id FROM users WHERE is_agent = false ORDER BY created_at ASC LIMIT 1);
