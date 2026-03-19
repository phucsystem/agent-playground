# Phase 1: Database Schema + Types

## Context

- [agent_configs schema](../../supabase/migrations/007_agent_webhooks.sql)
- [Type definitions](../../src/types/database.ts)
- [DB Design doc](../../docs/DB_DESIGN.md)

## Overview

- **Priority:** P1 (foundation for all other phases)
- **Status:** Complete
- **Effort:** 2h

Extend `agent_configs` with agent metadata columns and add a composite index on `webhook_delivery_logs` for stats queries.

## Requirements

### Functional
- Admin can set agent description (markdown, max 1000 chars)
- Admin can assign tags (text array, max 10 items)
- Admin can set category from predefined list
- Admin can add sample prompts (text array, max 5 items)
- Admin can toggle `is_featured` flag

### Non-Functional
- Migration must be non-destructive (ADD COLUMN only)
- All new columns nullable — existing agents work without metadata
- Stats query must use index, not seq scan

## Architecture

```
agent_configs (BEFORE)              agent_configs (AFTER)
├─ id                               ├─ id
├─ user_id (unique)                 ├─ user_id (unique)
├─ webhook_url                      ├─ webhook_url
├─ webhook_secret                   ├─ webhook_secret
├─ health_check_url                 ├─ health_check_url
├─ is_webhook_active                ├─ is_webhook_active
├─ created_at                       ├─ created_at
└─ updated_at                       ├─ updated_at
                                    ├─ description (text, nullable)       NEW
                                    ├─ tags (text[], nullable)            NEW
                                    ├─ category (text, nullable)          NEW
                                    ├─ sample_prompts (text[], nullable)  NEW
                                    └─ is_featured (boolean, default false) NEW
```

**Category values** (app-level enum, not DB enum — easier to extend):
`writing`, `code`, `research`, `data`, `support`, `creative`, `ops`, `general`

## Related Code Files

### Create
- `supabase/migrations/021_agent_metadata.sql` — schema migration

### Modify
- `src/types/database.ts` — extend `AgentConfig` interface

## Implementation Steps

1. **Create migration file** `supabase/migrations/021_agent_metadata.sql`:
   ```sql
   -- Add agent metadata columns for discovery
   ALTER TABLE agent_configs
     ADD COLUMN description text,
     ADD COLUMN tags text[],
     ADD COLUMN category text,
     ADD COLUMN sample_prompts text[],
     ADD COLUMN is_featured boolean NOT NULL DEFAULT false;

   -- Composite index for stats aggregation from delivery logs
   CREATE INDEX idx_webhook_delivery_logs_agent_status_created
     ON webhook_delivery_logs (agent_id, status, created_at DESC);

   -- Partial index for featured agents (rare flag)
   CREATE INDEX idx_agent_configs_featured
     ON agent_configs (is_featured) WHERE is_featured = true;
   ```

2. **Update TypeScript types** in `src/types/database.ts`:
   ```typescript
   export type AgentCategory = 'writing' | 'code' | 'research' | 'data' | 'support' | 'creative' | 'ops' | 'general';

   export interface AgentConfig {
     // ... existing fields ...
     description: string | null;
     tags: string[] | null;
     category: AgentCategory | null;
     sample_prompts: string[] | null;
     is_featured: boolean;
   }
   ```

3. **Update Database interface** — add new fields to `agent_configs` Insert/Update types

## Todo List

- [x] Create `023_agent_metadata.sql` migration (used 023 due to existing 021/022)
- [x] Add composite index on `webhook_delivery_logs`
- [x] Add partial index for featured agents
- [x] Update `AgentConfig` interface in `database.ts`
- [x] Add `AgentCategory` type
- [x] Update `Database` interface Insert/Update types
- [x] Verify migration is non-destructive

## Success Criteria

- Migration runs without errors
- Existing `agent_configs` rows unaffected (new columns null/false)
- TypeScript types compile
- Index exists on `webhook_delivery_logs(agent_id, status, created_at)`

## Risk Assessment

- **Low risk** — ADD COLUMN on small table, no locks
- **Rollback:** `ALTER TABLE agent_configs DROP COLUMN ...` for each

## Security Considerations

- RLS unchanged — admin-only CRUD on `agent_configs` persists
- `description` field will be rendered as markdown — sanitized by `react-markdown` (existing pattern)
- `webhook_secret` never exposed in catalog queries
