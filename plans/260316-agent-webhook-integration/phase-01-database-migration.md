# Phase 1: Database Migration

## Context

- [DB_DESIGN.md](../../docs/DB_DESIGN.md) — E-07 agent_configs, E-08 webhook_delivery_logs
- [SRD.md](../../docs/SRD.md) — FR-22, FR-25

## Overview

- **Priority:** P1 (blocks all other phases)
- **Status:** Pending
- **Effort:** 2h

Create migration `007_agent_webhooks.sql` with new enum, 2 tables, RLS policies, trigger function, and TypeScript types.

## Requirements

- `delivery_status` enum: `pending`, `delivered`, `failed`
- `agent_configs` table: one-to-one with agent users, stores webhook URL + secret
- `webhook_delivery_logs` table: tracks delivery per message per agent
- `notify_webhook_dispatch()` trigger on `messages` INSERT
- RLS: admin-only for both tables
- TypeScript types updated in `database.ts`

## Related Code Files

**Create:**
- `/Users/phuc/Code/04-llms/agent-labs/supabase/migrations/007_agent_webhooks.sql`

**Modify:**
- `/Users/phuc/Code/04-llms/agent-labs/src/types/database.ts` — Add AgentConfig, WebhookDeliveryLog, DeliveryStatus types
- `/Users/phuc/Code/04-llms/agent-labs/supabase/seed.sql` — Add webhook configs for seeded agents

## Implementation Steps

1. Create `007_agent_webhooks.sql`:

```sql
-- 1. Create delivery_status enum
CREATE TYPE delivery_status AS ENUM ('pending', 'delivered', 'failed');

-- 2. Create agent_configs table (E-07)
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

-- 3. Create webhook_delivery_logs table (E-08)
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

-- 4. Enable RLS
ALTER TABLE agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_delivery_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for agent_configs (admin-only)
CREATE POLICY "agent_configs_select" ON agent_configs FOR SELECT USING (is_admin());
CREATE POLICY "agent_configs_insert" ON agent_configs FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "agent_configs_update" ON agent_configs FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "agent_configs_delete" ON agent_configs FOR DELETE USING (is_admin());

-- 6. RLS policies for webhook_delivery_logs (admin read-only; Edge Function inserts via service role)
CREATE POLICY "webhook_logs_select" ON webhook_delivery_logs FOR SELECT USING (is_admin());

-- 7. Trigger function: notify Edge Function on new human message
CREATE OR REPLACE FUNCTION notify_webhook_dispatch()
RETURNS trigger AS $$
DECLARE
  sender_is_agent boolean;
BEGIN
  SELECT is_agent INTO sender_is_agent FROM users WHERE id = NEW.sender_id;

  IF sender_is_agent = true THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM conversation_members cm
    JOIN agent_configs ac ON ac.user_id = cm.user_id
    WHERE cm.conversation_id = NEW.conversation_id
      AND ac.is_webhook_active = true
      AND cm.user_id != NEW.sender_id
  ) THEN
    PERFORM pg_notify('webhook_dispatch', json_build_object(
      'message_id', NEW.id,
      'conversation_id', NEW.conversation_id,
      'sender_id', NEW.sender_id
    )::text);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_webhook_dispatch
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_webhook_dispatch();
```

2. Update TypeScript types in `database.ts`:

```typescript
export type DeliveryStatus = "pending" | "delivered" | "failed";

export interface AgentConfig {
  id: string;
  user_id: string;
  webhook_url: string;
  webhook_secret: string | null;
  is_webhook_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebhookDeliveryLog {
  id: string;
  message_id: string;
  agent_id: string;
  status: DeliveryStatus;
  http_status: number | null;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  delivered_at: string | null;
}
```

Add to `Database.public.Tables`:
```typescript
agent_configs: { Row: AgentConfig; Insert: Omit<AgentConfig, "id" | "created_at" | "updated_at">; Update: Partial<AgentConfig>; Relationships: [] };
webhook_delivery_logs: { Row: WebhookDeliveryLog; Insert: Omit<WebhookDeliveryLog, "id" | "created_at">; Update: Partial<WebhookDeliveryLog>; Relationships: [] };
```

3. Update seed.sql — add webhook configs for Claude Agent and GPT-4 Agent:

```sql
INSERT INTO agent_configs (user_id, webhook_url, webhook_secret, is_webhook_active)
VALUES
  ((SELECT id FROM users WHERE display_name = 'Claude Agent'), 'https://example.com/claude-webhook', 'whsec_test_claude_001', true),
  ((SELECT id FROM users WHERE display_name = 'GPT-4 Agent'), 'https://example.com/gpt4-webhook', null, true);
```

4. Run migration: `supabase db push`

## Todo

- [x] Create `007_agent_webhooks.sql` with enum + tables + RLS + trigger
- [x] Update `src/types/database.ts` with new types
- [x] Update `supabase/seed.sql` with agent config seed data
- [x] Run `supabase db push` and verify

## Success Criteria

- `agent_configs` and `webhook_delivery_logs` tables exist
- RLS blocks non-admin access
- Trigger fires `pg_notify` on human message INSERT
- Trigger skips agent-sent messages
- TypeScript types compile without errors

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Trigger on every message INSERT adds latency | Low — pg_notify is async, <1ms overhead | Monitor query times after deploy |
| CHECK constraint on webhook_url blocks HTTP urls | Intentional — agents should use HTTPS | Document clearly, allow exception via admin override if needed |

## Security

- `webhook_secret` stored as plaintext in DB. For production: consider encryption at rest via pgcrypto or Supabase Vault.
- RLS ensures only admins can read/write configs and logs.
- Service role key used by Edge Function for log inserts bypasses RLS intentionally.
