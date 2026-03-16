# Phase 1: DB Migration + Types

**Priority:** High
**Status:** completed
**Effort:** S (Small)

## Overview

Add `health_check_url` nullable column to `agent_configs` table. Update TypeScript types.

## Related Files

**Create:**
- `supabase/migrations/014_agent_health_check_url.sql`

**Modify:**
- `src/types/database.ts`

## Implementation Steps

### 1. Create Migration

File: `supabase/migrations/014_agent_health_check_url.sql`

```sql
-- Add health check URL to agent configs
ALTER TABLE agent_configs
  ADD COLUMN IF NOT EXISTS health_check_url text DEFAULT NULL;

-- Validate health_check_url is HTTPS if set
ALTER TABLE agent_configs
  ADD CONSTRAINT agent_configs_health_check_url_https
  CHECK (health_check_url IS NULL OR health_check_url LIKE 'https://%');
```

### 2. Update TypeScript Types

In `src/types/database.ts`, add to `AgentConfig` interface:

```typescript
health_check_url: string | null;
```

### 3. Update Agent Configs Hook

In `src/hooks/use-agent-configs.ts`, add `health_check_url` to the select query.

## Todo

- [x] Create migration file
- [x] Run `supabase db push` to apply
- [x] Update `AgentConfig` interface in `database.ts`
- [x] Add `health_check_url` to select in `use-agent-configs.ts`
- [x] Compile check

## Success Criteria

- Column exists in `agent_configs` table
- HTTPS-only CHECK constraint enforced
- TypeScript types updated
- Existing agent configs unaffected (NULL default)
