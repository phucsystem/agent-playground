# Phase 1: Database — Add metadata Column to agent_configs

## Context
- [Migration 007](../../supabase/migrations/007_agent_webhooks.sql) — original agent_configs schema
- [Migration 014](../../supabase/migrations/014_agent_health_check_url.sql) — added health_check_url

## Overview
- **Priority:** P1 (blocks Phase 2 and 3)
- **Status:** complete
- **Effort:** 15m

## Key Insight
`agent_configs` currently has no `metadata` column. Need JSONB column to store `goclaw_agent_key` and future config extensions. This is a non-breaking additive change.

## Requirements
- Add `metadata jsonb DEFAULT '{}'::jsonb` column to `agent_configs`
- No constraints needed (flexible JSON)
- No RLS changes (existing admin-only policies cover new column)

## Migration SQL

File: `supabase/migrations/0XX_agent_configs_metadata.sql`

```sql
-- Add metadata JSONB column to agent_configs for extensible config
-- Used initially for GoClaw integration (goclaw_agent_key)
ALTER TABLE agent_configs
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
```

## Related Code Files
- `src/types/database.ts` — Update `AgentConfig` interface (Phase 3)
- `src/hooks/use-agent-configs.ts` — Include metadata in queries (Phase 3)

## Implementation Steps
1. Create migration file with the SQL above
2. User runs `supabase db push` manually

## Todo
- [x] Create migration SQL file (`supabase/migrations/023_agent_configs_metadata.sql`)
- [x] Document in plan that user must apply migration

## Success Criteria
- `agent_configs` table has `metadata` JSONB column
- Existing rows get `{}` default
- No downtime or data loss
