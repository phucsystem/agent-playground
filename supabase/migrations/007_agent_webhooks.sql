-- Phase 5: Agent Webhook Integration
-- Creates agent_configs and webhook_delivery_logs tables
-- Adds trigger to notify Edge Function on new human messages

-- 1. Delivery status enum
CREATE TYPE delivery_status AS ENUM ('pending', 'delivered', 'failed');

-- 2. Agent webhook configuration (E-07)
-- One-to-one with agent users. Stores webhook URL + optional HMAC secret.
CREATE TABLE agent_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  webhook_url text NOT NULL CHECK (webhook_url LIKE 'https://%'),
  webhook_secret text,
  is_webhook_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_configs_user_id ON agent_configs(user_id);

-- 3. Webhook delivery tracking (E-08)
-- One log entry per message per agent. Tracks retries and final status.
CREATE TABLE webhook_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status delivery_status NOT NULL DEFAULT 'pending',
  http_status integer,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);

CREATE INDEX idx_webhook_logs_agent_created ON webhook_delivery_logs(agent_id, created_at DESC);
CREATE INDEX idx_webhook_logs_status ON webhook_delivery_logs(status);
CREATE INDEX idx_webhook_logs_message_id ON webhook_delivery_logs(message_id);

-- 4. Enable RLS on both tables
ALTER TABLE agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_delivery_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for agent_configs (admin-only CRUD)
CREATE POLICY "agent_configs_select" ON agent_configs
  FOR SELECT USING (is_admin());

CREATE POLICY "agent_configs_insert" ON agent_configs
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "agent_configs_update" ON agent_configs
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "agent_configs_delete" ON agent_configs
  FOR DELETE USING (is_admin());

-- 6. RLS policies for webhook_delivery_logs (admin read-only)
-- Edge Function inserts via service_role key (bypasses RLS)
CREATE POLICY "webhook_logs_select" ON webhook_delivery_logs
  FOR SELECT USING (is_admin());

-- 7. Webhook dispatch via Supabase Database Webhook (configured in dashboard)
--
-- HOW IT WORKS:
-- Supabase Database Webhooks fire on `messages` INSERT and POST the new row
-- to the Edge Function `webhook-dispatch`. The Edge Function handles:
-- - Checking if sender is agent (skip to prevent loops)
-- - Querying agent_configs for active webhooks in the conversation
-- - Dispatching HTTP POST to each agent's webhook_url
--
-- SETUP (Supabase Dashboard → Database → Webhooks):
--   Name: webhook_dispatch
--   Table: messages
--   Events: INSERT
--   Type: Supabase Edge Function
--   Function: webhook-dispatch
--   Headers: Authorization: Bearer {SERVICE_ROLE_KEY}
--
-- No PL/pgSQL trigger needed — Database Webhooks handle the event routing.
