-- Add agent metadata columns for discovery
ALTER TABLE agent_configs
  ADD COLUMN description text,
  ADD COLUMN tags text[],
  ADD COLUMN category text,
  ADD COLUMN sample_prompts text[],
  ADD COLUMN is_featured boolean NOT NULL DEFAULT false;

-- Composite index for stats aggregation from delivery logs
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_agent_status_created
  ON webhook_delivery_logs (agent_id, status, created_at DESC);

-- Partial index for featured agents (rare flag)
CREATE INDEX IF NOT EXISTS idx_agent_configs_featured
  ON agent_configs (is_featured) WHERE is_featured = true;

-- RPC function to aggregate agent delivery stats (auth required)
CREATE OR REPLACE FUNCTION get_agent_stats(agent_ids uuid[], days_back int DEFAULT 7)
RETURNS TABLE(
  agent_id uuid,
  total_deliveries bigint,
  successful_deliveries bigint,
  avg_response_ms numeric
) AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT
    wdl.agent_id,
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE wdl.status = 'delivered')::bigint,
    ROUND(AVG(EXTRACT(EPOCH FROM (wdl.delivered_at - wdl.created_at)) * 1000)
      FILTER (WHERE wdl.status = 'delivered'), 0)
  FROM webhook_delivery_logs wdl
  WHERE wdl.agent_id = ANY(agent_ids)
    AND wdl.created_at > NOW() - (days_back || ' days')::interval
  GROUP BY wdl.agent_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- RPC to fetch agent catalog metadata (bypasses RLS, returns only safe fields)
CREATE OR REPLACE FUNCTION get_agent_catalog(ws_id uuid)
RETURNS TABLE(
  config_id uuid,
  user_id uuid,
  is_webhook_active boolean,
  health_check_url text,
  description text,
  tags text[],
  category text,
  sample_prompts text[],
  is_featured boolean
) AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT
    ac.id,
    ac.user_id,
    ac.is_webhook_active,
    ac.health_check_url,
    ac.description,
    ac.tags,
    ac.category,
    ac.sample_prompts,
    ac.is_featured
  FROM agent_configs ac
  JOIN users u ON ac.user_id = u.id
  JOIN workspace_members wm ON u.id = wm.user_id
  WHERE wm.workspace_id = ws_id
    AND u.is_agent = true
    AND u.is_active = true;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
