# Agent Health Check — Implementation Plan

**Date:** 2026-03-17
**Status:** completed
**Brainstorm:** `plans/reports/brainstorm-260317-agent-health-check.md`

## Summary

Add agent availability detection via configurable health check URLs. Server-side API proxy with TTL cache fans out to agents, exposes status to clients via polling hook. UI shows status dots on avatars + toast on transitions.

## Phases

| # | Phase | Status | Effort |
|---|-------|--------|--------|
| 1 | DB Migration + Types | completed | S |
| 2 | API Route (proxy + cache) | completed | M |
| 3 | React Hook | completed | S |
| 4 | Admin UI (config form) | completed | S |
| 5 | Chat UI (status dot + toast) | completed | M |

## Dependencies

```
Phase 1 → Phase 2 → Phase 3 → Phase 5
Phase 1 → Phase 4
```

Phase 4 and Phase 3 are independent of each other.

## Key Files

**New:**
- `supabase/migrations/014_agent_health_check_url.sql`
- `src/app/api/agents/health/route.ts`
- `src/hooks/use-agent-health.ts`

**Modified:**
- `src/types/database.ts` — add `health_check_url` to `AgentConfig`
- `src/components/admin/webhook-config-form.tsx` — add health URL field
- `src/hooks/use-agent-configs.ts` — include `health_check_url` in queries
- `src/components/ui/avatar.tsx` — add `healthStatus` prop for colored dot
- `src/components/sidebar/conversation-list.tsx` — pass health status to DM avatars
- `src/components/sidebar/sidebar.tsx` — wire health hook
- `src/app/chat/layout.tsx` — initialize health hook
