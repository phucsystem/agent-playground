# Phase 2: API Route (Proxy + Cache)

**Priority:** High
**Status:** completed
**Effort:** M (Medium)
**Depends on:** Phase 1

## Overview

Next.js API route that proxies health checks to agents. Server fans out in parallel with 5s timeout per agent. In-memory cache with 5-min TTL prevents hammering.

## Related Files

**Create:**
- `src/app/api/agents/health/route.ts`

## Architecture

```
GET /api/agents/health
  → Check cache (5-min TTL)
  → If fresh: return cached results
  → If stale:
    → Query agent_configs (service role) for agents with health_check_url
    → Promise.allSettled: GET each health_check_url (5s timeout)
    → Build status map: { agentId: 'healthy' | 'unhealthy' }
    → Cache results
    → Return response
```

## Implementation Steps

### 1. Create API Route

File: `src/app/api/agents/health/route.ts`

```typescript
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export type AgentHealthStatus = "healthy" | "unhealthy" | "unknown";

interface AgentHealthEntry {
  agentId: string;
  status: AgentHealthStatus;
  checkedAt: string;
}

interface CachedResult {
  agents: AgentHealthEntry[];
  cachedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const HEALTH_TIMEOUT_MS = 5000; // 5 seconds
let cachedResult: CachedResult | null = null;

export async function GET() {
  // Return cache if fresh
  if (cachedResult && Date.now() - cachedResult.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({ agents: cachedResult.agents });
  }

  // Fetch agents with health_check_url configured
  const supabase = await createServerSupabaseClient();
  const { data: configs } = await supabase
    .from("agent_configs")
    .select("user_id, health_check_url")
    .not("health_check_url", "is", null)
    .eq("is_webhook_active", true);

  if (!configs || configs.length === 0) {
    const emptyResult: AgentHealthEntry[] = [];
    cachedResult = { agents: emptyResult, cachedAt: Date.now() };
    return NextResponse.json({ agents: emptyResult });
  }

  // Fan-out health checks in parallel
  const checkedAt = new Date().toISOString();
  const results = await Promise.allSettled(
    configs.map(async (config) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

      try {
        const response = await fetch(config.health_check_url!, {
          method: "GET",
          signal: controller.signal,
        });
        return {
          agentId: config.user_id,
          status: (response.ok ? "healthy" : "unhealthy") as AgentHealthStatus,
          checkedAt,
        };
      } catch {
        return {
          agentId: config.user_id,
          status: "unhealthy" as AgentHealthStatus,
          checkedAt,
        };
      } finally {
        clearTimeout(timeout);
      }
    })
  );

  const agents: AgentHealthEntry[] = results.map((result) =>
    result.status === "fulfilled"
      ? result.value
      : { agentId: "", status: "unhealthy" as AgentHealthStatus, checkedAt }
  ).filter((entry) => entry.agentId !== "");

  // Cache
  cachedResult = { agents, cachedAt: Date.now() };

  return NextResponse.json({ agents });
}
```

### Key Design Decisions

- **No auth required** — response only contains agent IDs + status, no URLs exposed
- **Module-level cache** — persists across requests in same server process
- **`Promise.allSettled`** — one slow/failing agent doesn't block others
- **5s timeout via AbortController** — bounds worst-case response time
- **Service role client** — reads agent_configs (RLS restricts to admin, but API needs access)

## Todo

- [x] Create `src/app/api/agents/health/route.ts`
- [x] Verify service role client reads agent_configs correctly
- [x] Test with agent that returns 200
- [x] Test with unreachable agent (timeout path)
- [x] Test cache behavior (second request within 5 min returns cached)
- [x] Compile check

## Success Criteria

- `GET /api/agents/health` returns `{ agents: [...] }`
- Agents with health URL get pinged, results cached 5 min
- No agent URLs leaked in response
- 5s timeout per agent, total response bounded
