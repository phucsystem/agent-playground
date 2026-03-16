# Brainstorm: Agent Health Check Endpoint

**Date:** 2026-03-17
**Status:** Agreed
**Topic:** Each agent supports `/health` endpoint to detect availability; surface status to users

---

## Problem Statement

Agents connect via webhooks but there's no way to know if an agent is alive before sending a message. Users discover unavailability only after waiting 30s for a timeout. Need proactive health detection so users know agent readiness upfront.

## Current State

- **Webhook delivery logs** track success/failure passively (after-the-fact)
- **Agent thinking indicator** uses 30s client-side timeout heuristic
- **Online presence** tracks humans only; agents excluded
- **No health check**, no heartbeat, no agent status indicator in UI

## Evaluated Approaches

### 1. Client-Side Direct Calls — REJECTED
Browser calls each agent's `/health` directly.
- **Pros:** No server component, instant feedback
- **Cons:** Exposes agent URLs to browser (security), CORS dependency on every agent, mixed content risk, N×clients×agents requests
- **Verdict:** URL leakage is a dealbreaker

### 2. Server-Side Background Polling (Cron)
Edge Function or cron pings agents periodically, stores results in DB.
- **Pros:** Reliable, no client complexity
- **Cons:** Needs cron infrastructure, DB writes every interval, overkill for 5-min checks
- **Verdict:** Viable but heavier than needed

### 3. API Proxy with TTL Cache — SELECTED
Thin Next.js API route. Client requests trigger server fan-out with in-memory cache.
- **Pros:** No URL exposure, no CORS issues, no cron needed, single client endpoint, cache prevents agent hammering
- **Cons:** First request after cache expiry has slight latency (~5s max)
- **Verdict:** Best balance of simplicity, security, and UX

## Agreed Solution

### Architecture

```
Browser (hook)           Next.js API Route              Agents
─────────────           ──────────────────              ──────

useAgentHealth()  →  GET /api/agents/health  →  GET {health_check_url}
  polls every 5m        │ cache (5m TTL)          returns 200 OK
  gets status map       │ Promise.allSettled()     or timeout/error
                        └→ { agents: [{ id, status, checkedAt }] }
```

### Components

| Layer | Component | Details |
|-------|-----------|---------|
| DB | `agent_configs.health_check_url` | New nullable column, admin-configurable |
| Admin UI | Health URL field | Optional input in webhook config form |
| API Route | `GET /api/agents/health` | Fan-out parallel pings, 5s timeout, 5m cache, no auth (returns status only, no URLs) |
| Hook | `useAgentHealth()` | Polls API every 5 min, returns `Map<agentId, 'healthy'\|'unhealthy'\|'unknown'>` |
| Sidebar | Status dot on avatar | Green=healthy, gray=unknown, red=unhealthy |
| Toast | Change notification | "Claude Agent is now available" / "GPT-4 Agent is unavailable" |

### Health Contract (Agent Side)

- Agent exposes an HTTP GET endpoint (URL configurable per agent)
- **Minimum:** Return HTTP 200 = healthy; any other status or timeout = unhealthy
- No specific response body required
- 5-second timeout per check

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| No DB persistence for status | Ephemeral data; in-memory cache sufficient |
| No Supabase Realtime | 5-min polling doesn't justify realtime channel overhead |
| Gray dot for unconfigured agents | Don't penalize agents without health URL as "down" |
| Configurable health URL (not derived) | Max flexibility — agents may host health at any path |
| Proxy over direct | Prevents URL leak, eliminates CORS dependency |

### Risk Assessment

| Risk | Mitigation |
|------|------------|
| Cache stale after agent crash | 5-min max staleness acceptable for chat UX |
| API route cold start delays | Next.js keeps routes warm; 5s timeout bounds worst case |
| Agent health URL misconfigured | Validate URL format on save; treat errors as "unhealthy" not crash |
| Many agents = slow fan-out | `Promise.allSettled` with 5s timeout caps total time |

## Implementation Considerations

- Add `health_check_url` column via new migration
- Reuse existing `webhook-config-form.tsx` — add optional field
- New API route at `src/app/api/agents/health/route.ts`
- New hook `src/hooks/use-agent-health.ts`
- Extend sidebar avatar component with status dot
- Reuse existing toast pattern from `presence-toast.tsx`

## Success Criteria

- [ ] Agents with health URL show correct green/red status within 5 min
- [ ] Agents without health URL show gray (unknown) — no false negatives
- [ ] No agent webhook URLs exposed to browser
- [ ] Toast fires on status transitions (healthy↔unhealthy)
- [ ] Admin can configure/update health URL in webhook settings

## Next Steps

1. Create implementation plan with phased delivery
2. DB migration for `health_check_url` column
3. API route + caching logic
4. React hook + UI integration
