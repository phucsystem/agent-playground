# Code Review: Agent Health Check Feature

**Reviewer:** code-reviewer
**Date:** 2026-03-17
**Focus:** Security, correctness, UI rendering, TypeScript safety

---

## Scope

- Files: 12
- LOC: ~500 (new/modified)
- Focus: Full feature review (API, hooks, UI, admin, migration)

## Overall Assessment

Solid implementation. Clean separation of concerns: server-side health probing via API route, client-side polling + transition detection via hook, UI dot rendering on avatars, toast notifications for status changes. The code is readable and well-structured. Several issues found, one critical (SSRF), one high (missing auth guard), and a few medium-priority items.

---

## Critical Issues

### 1. SSRF via health_check_url (Server-Side Request Forgery)

**File:** `src/app/api/agents/health/route.ts:54`

The API route fetches arbitrary URLs stored in `agent_configs.health_check_url`. The DB constraint only enforces `https://` prefix, but an admin could set `https://169.254.169.254/latest/meta-data/` (cloud metadata endpoint via DNS rebinding) or `https://internal-service.local/admin`.

The server-side `fetch()` call at line 54 has no URL validation beyond what the DB constraint provides.

**Impact:** A malicious or compromised admin could probe internal network, cloud metadata APIs, or other internal services from the server.

**Recommended fix:**
```typescript
function isAllowedHealthUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    // Block private/reserved IPs and metadata endpoints
    const blocked = [
      /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/,
      /^127\./,
      /^169\.254\./,
      /^0\./,
      /localhost/i,
      /\.local$/i,
      /\.internal$/i,
    ];
    return !blocked.some((pattern) => pattern.test(hostname));
  } catch {
    return false;
  }
}
```

Apply before each fetch call. Alternatively, validate at write-time in the admin CRUD operations.

**Severity:** CRITICAL

---

## High Priority

### 2. No authentication guard on GET /api/agents/health

**File:** `src/app/api/agents/health/route.ts:29`

The middleware does run for this route (the matcher excludes only `api/auth/`), so Supabase session cookies are refreshed. However, the route handler itself never verifies the user is authenticated. The middleware refreshes tokens and redirects unauthenticated browser navigations, but for direct API calls (e.g., `curl`), the middleware only redirects HTML page requests -- API fetch calls from an unauthenticated context could still reach this handler.

The route uses `SUPABASE_SERVICE_ROLE_KEY` to query `agent_configs`, so the data returned is not scoped to any user. Any authenticated user (not just admins) can see all agent health statuses. This is likely acceptable for the chat UI, but should be documented as intentional.

**Recommended fix:** Add explicit auth check:
```typescript
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET() {
  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ... rest of handler
}
```

**Severity:** HIGH

### 3. Module-level cache shared across all users (serverless cold start risk)

**File:** `src/app/api/agents/health/route.ts:20`

`let cachedResult: CachedResult | null = null;` is module-level state. In serverless (Vercel), this persists within a single Lambda instance but is not shared across instances. This means:
- Different users may get different cache states depending on which instance handles their request
- Cache is lost on cold starts, leading to inconsistent behavior

This is acceptable for a 5-minute TTL health cache, but be aware it's not a true shared cache. If consistency matters, consider using a KV store or Redis.

**Severity:** HIGH (awareness -- no immediate action needed unless deploying at scale)

### 4. health_check_url not validated as HTTPS on client-side create form

**File:** `src/app/admin/page.tsx:253`

When creating an agent, `healthCheckUrl` is passed directly to `createConfig()` without HTTPS validation. The inline webhook editor (line 657) correctly disables save when URL doesn't start with `https://`, but the create flow does not.

The DB constraint will reject non-HTTPS URLs, but users will get an opaque Supabase error instead of a clear validation message.

**Recommended fix:** Add client-side validation before `handleCreateInvite()` submits, same as the inline editor does.

**Severity:** HIGH

---

## Medium Priority

### 5. Health check URL leaked to client via useAgentConfigs select query

**File:** `src/hooks/use-agent-configs.ts:15`

The `select()` includes `health_check_url` which is sent to the admin client. This is fine for admin-only pages, but confirm RLS policies on `agent_configs` prevent non-admin users from reading this data. Internal health check URLs could reveal infrastructure details.

**Severity:** MEDIUM

### 6. Duplicate type definitions for AgentHealthStatus

**Files:** `src/app/api/agents/health/route.ts:4` and `src/hooks/use-agent-health.ts:5`

`AgentHealthStatus` is defined in both files with different values:
- Route: `"healthy" | "unhealthy"` (2 values)
- Hook: `"healthy" | "unhealthy" | "unknown"` (3 values)

These should be unified in a shared types file. The hook version is the canonical one since it includes `"unknown"` for initial/missing state.

**Recommended fix:** Create a shared type in `src/types/database.ts` or a new `src/types/health.ts` and import from both locations.

**Severity:** MEDIUM

### 7. Transitions array never detects agents going offline (removed from response)

**File:** `src/hooks/use-agent-health.ts:41-46`

The transition detection loop only iterates `newMap` entries. If an agent was in `previousMapRef` but is absent from the new response (e.g., admin removed health URL), no transition is emitted. The agent silently disappears from the health map.

**Recommended fix:**
```typescript
// Also detect agents that disappeared
for (const [agentId, previousStatus] of previousMapRef.current) {
  if (!newMap.has(agentId) && previousStatus !== "unknown") {
    newTransitions.push({ agentId, previousStatus, newStatus: "unknown" });
  }
}
```

**Severity:** MEDIUM

### 8. Toast shows "Agent" fallback when agent has no DM conversation

**File:** `src/app/chat/layout.tsx:71`

If a health transition fires for an agent the current user has no DM with, `agentConv` is undefined and the toast shows "Agent" as the name. This could confuse users. Consider either suppressing the toast in this case or looking up the agent name from a different source.

**Severity:** MEDIUM (UX)

### 9. Avatar health dot and bot icon are mutually exclusive

**File:** `src/components/ui/avatar.tsx:79-88`

When `healthStatus` is provided for an agent, the bot icon is replaced by the health dot. Users lose the visual indicator that this is an agent (the bot badge). Consider overlaying both or incorporating the bot icon into the health dot design.

**Severity:** MEDIUM (UX)

---

## Low Priority

### 10. AbortController timeout not canceled on successful fetch

This is actually handled correctly at line 70 with `finally { clearTimeout(timeout); }`. Good.

### 11. `Promise.allSettled` filter discards rejected promises silently

**File:** `src/app/api/agents/health/route.ts:75-80`

Since the inner async function catches all errors and returns an `AgentHealthEntry` with `"unhealthy"` status, rejected promises should never occur. The `filter` for `fulfilled` is defensive but effectively dead code. Not harmful.

### 12. InlineWebhookEditor uses non-null assertion on `config!`

**File:** `src/app/admin/page.tsx:567-570`

The early return at line 562 (`if (!config) return null`) makes these safe, but TypeScript narrowing doesn't carry into the inner function `handleSave`. Consider capturing `config` in a local const before the function definition.

**Severity:** LOW

---

## Positive Observations

1. **Clean hook design** -- `useAgentHealth` properly uses refs for previous state comparison, avoids triggering toasts on initial load
2. **Good timeout handling** -- AbortController + clearTimeout in finally block is correct
3. **DB-level HTTPS constraint** -- Defense in depth via `agent_configs_health_check_url_https` CHECK constraint
4. **Idempotent migration** -- `IF NOT EXISTS` checks for both column and constraint
5. **Proper prop threading** -- `getAgentHealthStatus` callback passed cleanly through Sidebar > ConversationList > ConversationItem > Avatar
6. **Toast deduplication** -- Using `id: health-${transition.agentId}` prevents duplicate toasts for same agent

---

## Recommended Actions (Priority Order)

1. **CRITICAL** -- Add SSRF protection to health URL fetching (validate URL against blocklist before `fetch`)
2. **HIGH** -- Add explicit auth check in the API route handler
3. **HIGH** -- Add client-side HTTPS validation for health URL on create form
4. **MEDIUM** -- Unify `AgentHealthStatus` type definitions
5. **MEDIUM** -- Detect agents removed from health response (disappeared transitions)
6. **MEDIUM** -- Consider keeping bot icon visible alongside health dot
7. **LOW** -- Fix TypeScript narrowing in `InlineWebhookEditor.handleSave`

---

## Metrics

- Type Coverage: Good -- all props typed, interfaces defined
- Test Coverage: Unknown (no tests provided)
- Linting Issues: Not checked per instructions
- Security Issues: 2 (SSRF, missing auth guard)

---

## Unresolved Questions

1. Are RLS policies on `agent_configs` table restricting read access to admin users only? If not, any authenticated user could read health check URLs via Supabase client.
2. Is the 5-minute poll interval + 5-minute cache TTL intentionally aligned? This means health status is effectively 5-10 minutes stale. For time-sensitive health monitoring, this may be too slow.
3. Should health checks run only when there are active users viewing the chat, or is the current always-polling approach acceptable?
