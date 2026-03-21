-- Add metadata JSONB column to agent_configs for extensible config
-- Used initially for GoClaw integration (goclaw_agent_key)
ALTER TABLE agent_configs
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
