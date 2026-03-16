-- Add health check URL to agent configs
ALTER TABLE agent_configs
  ADD COLUMN IF NOT EXISTS health_check_url text DEFAULT NULL;

-- Validate health_check_url is HTTPS if set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_configs_health_check_url_https'
  ) THEN
    ALTER TABLE agent_configs
      ADD CONSTRAINT agent_configs_health_check_url_https
      CHECK (health_check_url IS NULL OR health_check_url LIKE 'https://%');
  END IF;
END $$;
