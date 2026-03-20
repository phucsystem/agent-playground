# Phase 2: Data Hooks

## Context

- [Phase 1: Schema](./phase-01-database-schema.md)
- [use-agent-configs.ts](../../src/hooks/use-agent-configs.ts) — existing CRUD hook
- [use-agent-health.ts](../../src/hooks/use-agent-health.ts) — existing health polling
- [React Query patterns](../../docs/codebase-summary.md) — staleTime, query keys

## Overview

- **Priority:** P1
- **Status:** Complete
- **Effort:** 2h
- **Blocked by:** Phase 1

Two new React Query hooks: `useAgentCatalog` (agent list with metadata) and `useAgentStats` (performance stats from delivery logs).

## Requirements

### Functional
- Fetch workspace-scoped agents with metadata (description, tags, category, sample_prompts, is_featured)
- Filter by category, search by name/description
- Aggregate stats per agent: avg response time, uptime %, messages handled (last 7 days)
- Merge health status from existing `useAgentHealth`

### Non-Functional
- React Query with 5min staleTime (catalog), 5min staleTime (stats)
- Stats query scoped to last 7 days to bound dataset
- Graceful degradation: missing stats → show "—"

## Architecture

```
useAgentCatalog(workspaceId, { category?, search? })
  │
  └─▶ Supabase query:
      SELECT ac.*, u.display_name, u.avatar_url, u.is_agent, u.id as user_id
      FROM agent_configs ac
      JOIN users u ON ac.user_id = u.id
      JOIN workspace_members wm ON u.id = wm.user_id
      WHERE wm.workspace_id = :workspaceId
        AND u.is_agent = true
        AND u.is_active = true
      ORDER BY ac.is_featured DESC, u.display_name ASC

useAgentStats(agentIds: string[])
  │
  └─▶ Supabase query (last 7 days):
      SELECT
        agent_id,
        COUNT(*) as total_deliveries,
        COUNT(*) FILTER (WHERE status = 'delivered') as successful,
        AVG(EXTRACT(EPOCH FROM (delivered_at - created_at)) * 1000)
          FILTER (WHERE status = 'delivered') as avg_response_ms
      FROM webhook_delivery_logs
      WHERE agent_id IN (:agentIds)
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY agent_id
```

## Related Code Files

### Create
- `src/hooks/use-agent-catalog.ts` — catalog query hook
- `src/hooks/use-agent-stats.ts` — stats aggregation hook
- `src/types/agent-discovery.ts` — catalog-specific types

### Modify
- None (new files only)

## Implementation Steps

1. **Create types** in `src/types/agent-discovery.ts`:
   ```typescript
   import type { AgentConfig, AgentCategory } from "./database";

   export interface AgentCatalogEntry {
     id: string;
     user_id: string;
     display_name: string;
     avatar_url: string | null;
     description: string | null;
     tags: string[] | null;
     category: AgentCategory | null;
     sample_prompts: string[] | null;
     is_featured: boolean;
     is_webhook_active: boolean;
     health_check_url: string | null;
   }

   export interface AgentStats {
     agent_id: string;
     total_deliveries: number;
     successful_deliveries: number;
     avg_response_ms: number | null;
     uptime_pct: number;  // computed: successful / total * 100
   }

   export interface CatalogFilters {
     category?: AgentCategory;
     search?: string;
   }
   ```

2. **Create `use-agent-catalog.ts`**:
   - `useQuery(['agent-catalog', workspaceId, filters])`
   - Supabase join query: `agent_configs` + `users` + `workspace_members`
   - Client-side filter by `category` and `search` (small dataset, no need for server-side)
   - Exclude `webhook_secret` from select
   - staleTime: 5min, refetchOnWindowFocus: false

3. **Create `use-agent-stats.ts`**:
   - `useQuery(['agent-stats', agentIds], { enabled: agentIds.length > 0 })`
   - RPC call or raw query on `webhook_delivery_logs` with 7-day window
   - Compute `uptime_pct = successful / total * 100`
   - Return `Map<string, AgentStats>` for O(1) lookup
   - staleTime: 5min
   - If no deliveries for agent → return null stats (UI shows "—")

4. **Stats query approach**: Use Supabase `.rpc()` for aggregation OR client-side aggregation if dataset small. Recommend: **Supabase RPC function** for clean SQL aggregation.

   Create RPC in migration (add to phase 1 migration):
   ```sql
   CREATE OR REPLACE FUNCTION get_agent_stats(agent_ids uuid[], days_back int DEFAULT 7)
   RETURNS TABLE(
     agent_id uuid,
     total_deliveries bigint,
     successful_deliveries bigint,
     avg_response_ms numeric
   ) AS $$
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
   $$ LANGUAGE sql STABLE SECURITY DEFINER;
   ```

## Todo List

- [x] Create `src/types/agent-discovery.ts` with catalog types
- [x] Create `use-agent-catalog.ts` with React Query
- [x] Create `use-agent-stats.ts` with React Query
- [x] Add `get_agent_stats` RPC function to phase 1 migration
- [x] Add RPC types to `Database` interface

## Success Criteria

- `useAgentCatalog` returns workspace-scoped agents with metadata
- `useAgentStats` returns performance stats per agent
- Category and search filters work
- Missing stats degrade gracefully (null → "—")
- No `webhook_secret` exposed in catalog data

## Risk Assessment

- **Stats query performance** — bounded by 7-day window + composite index → low risk
- **Empty data** — agents with no deliveries return null stats → handled
