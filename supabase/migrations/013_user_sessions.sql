-- Migration: Add user_sessions table for multi-device login support
-- Max 3 concurrent sessions per user with device tracking

CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supabase_session_id text,
  device_name text NOT NULL,
  user_agent text,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_oldest ON user_sessions(user_id, last_active_at ASC);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
CREATE POLICY "user_sessions_select" ON user_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can delete their own sessions (logout / revoke)
CREATE POLICY "user_sessions_delete" ON user_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Users can update their own sessions (last_active_at)
CREATE POLICY "user_sessions_update" ON user_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- No INSERT policy for regular users — service role inserts during login
