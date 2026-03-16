# Code Review: Phase 5 — Agent Webhook Integration

**Reviewer:** code-reviewer
**Date:** 2026-03-16
**Scope:** 10 files, ~1671 LOC
**Focus:** Security, loop prevention, error handling, TypeScript, React patterns, code quality

---

## Overall Assessment

Solid implementation of a webhook dispatch system with good architectural separation. The trigger-based loop prevention, HMAC signing, retry logic with exponential backoff, and admin-only RLS policies are well done. Several security and correctness issues need attention before merge.

---

## Critical Issues

### C1. `webhook_secret` exposed to browser via `select("*")`

**File:** `src/hooks/use-agent-configs.ts:14-15`

```ts
const { data } = await supabase
  .from("agent_configs")
  .select("*")  // <-- fetches webhook_secret to the browser
```

The hook fetches all columns including `webhook_secret`, which is then stored in React state and available in browser memory/DevTools. Even though RLS restricts to admins, the secret should never leave the server.

**Fix:** Use an explicit column list excluding the secret:
```ts
.select("id, user_id, webhook_url, is_webhook_active, created_at, updated_at")
```

And update the `AgentConfig` type usage in the frontend to use a type without `webhook_secret`.

**Severity:** CRITICAL — webhook secrets in browser memory can be exfiltrated via XSS.

---

### C2. No HTTPS validation on `webhook_url` in Edge Function

**File:** `supabase/functions/webhook-dispatch/index.ts:115`

The DB has `CHECK (webhook_url LIKE 'https://%')` but the Edge Function does not validate the URL before `fetch()`. If the constraint is bypassed (e.g., service_role insert, migration), the function would POST to arbitrary URLs including internal network addresses (SSRF).

**Fix:** Add URL validation in the Edge Function before dispatch:
```ts
if (!config.webhook_url.startsWith("https://")) {
  // log error, skip this agent
  continue;
}
```

**Severity:** CRITICAL — potential SSRF if URL constraint is bypassed.

---

## High Priority

### H1. Trigger uses `pg_notify` but Edge Function expects Database Webhook payload

**File:** `supabase/migrations/007_agent_webhooks.sql:83-87` and `supabase/functions/webhook-dispatch/index.ts:162-172`

The migration creates a `pg_notify('webhook_dispatch', ...)` trigger, but the Edge Function is a Deno `serve()` handler expecting an HTTP POST with `{ type, record }` body shape — the standard Supabase Database Webhook payload format.

`pg_notify` sends a LISTEN/NOTIFY channel message. It does NOT automatically invoke a Supabase Edge Function. You need either:
1. A **Supabase Database Webhook** configured in the dashboard (sends HTTP POST to the Edge Function on INSERT), OR
2. A `pg_net` extension call to POST to the Edge Function URL directly from the trigger.

The current `pg_notify` call will fire into the void with no listener. The Edge Function will never be invoked.

**Fix:** Either:
- Replace `pg_notify` with `net.http_post()` using the `pg_net` extension to call the Edge Function URL, OR
- Remove the trigger entirely and configure a Supabase Database Webhook via dashboard/config for INSERT on `messages` table, with the Edge Function as target.

If using option 1, the trigger already has the right guard (skip agent senders), so the filter logic is preserved. But the Edge Function also re-checks `sender.is_agent` (line 186), providing defense-in-depth.

**Severity:** HIGH — feature is non-functional without this fix.

---

### H2. Race condition in `loadMore` pagination

**File:** `src/hooks/use-webhook-logs.ts:72-76`

```ts
function loadMore() {
  const nextOffset = offset + PAGE_SIZE;
  setOffset(nextOffset);
  fetchLogs(true);
}
```

`setOffset` is async (React state update), but `fetchLogs(true)` is called immediately after and uses the `offset` from the `useCallback` closure — which is still the OLD value. The `fetchLogs` callback captures `offset` in its dependency array, but the new offset hasn't been set yet when `fetchLogs(true)` runs.

**Fix:** Pass the offset explicitly:
```ts
function loadMore() {
  const nextOffset = offset + PAGE_SIZE;
  setOffset(nextOffset);
  // fetchLogs should accept offset parameter, or use useEffect to trigger on offset change
}
```

Better approach: trigger `fetchLogs(true)` via a `useEffect` that watches `offset` changes.

**Severity:** HIGH — "Load more" will re-fetch the same page repeatedly.

---

### H3. `useEffect` missing `fetchLogs` in dependency array

**File:** `src/hooks/use-webhook-logs.ts:68-70`

```ts
useEffect(() => {
  fetchLogs(false);
}, [filters.agentId, filters.status, filters.timeRange]);
```

React hooks exhaustive-deps rule: `fetchLogs` is missing from the dependency array. Since `fetchLogs` is wrapped in `useCallback` with `offset` as a dependency, filter changes could use a stale `fetchLogs` closure.

**Severity:** HIGH — could cause stale data after filter changes.

---

### H4. Admin page exceeds 200 LOC file size limit

**File:** `src/app/admin/page.tsx` — 341 lines

Project rules require files under 200 lines. This file has grown significantly with the webhook integration additions.

**Fix:** Extract the invite form into `src/components/admin/invite-form.tsx` and the user list into `src/components/admin/user-list.tsx`.

**Severity:** HIGH — violates project file-size convention.

---

## Medium Priority

### M1. Webhook dispatch retries block the Edge Function response

**File:** `supabase/functions/webhook-dispatch/index.ts:106-153`

The retry loop with `RETRY_DELAYS = [0, 10_000, 60_000]` means the Edge Function can block for up to 90+ seconds across 3 attempts per agent. With multiple agents, `Promise.allSettled` runs them in parallel, but Supabase Edge Functions have execution time limits (typically 2 minutes for pro, less for free tier).

If 3 agents each fail on all retries: 3 * 70s = 210s, which exceeds the limit even in parallel due to the function-level timeout.

**Fix:** Consider either:
- Reducing retry delays (e.g., `[0, 2_000, 5_000]`) for the synchronous path
- Implementing async retry via a separate scheduled function / queue

**Severity:** MEDIUM — affects reliability under failure conditions.

---

### M2. `handleCreateInvite` queries by token to get user ID

**File:** `src/app/admin/page.tsx:124-128`

```ts
const { data: newUsers } = await supabase
  .from("users")
  .select("id")
  .eq("token", token)
  .single();
```

The insert could return the ID directly using `.select("id").single()` on the insert call, avoiding an extra query and the (unlikely) race condition of duplicate tokens.

**Fix:**
```ts
const { data: insertedUser, error } = await supabase
  .from("users")
  .insert({ ... })
  .select("id")
  .single();
```

**Severity:** MEDIUM — unnecessary extra query and minor race window.

---

### M3. No rate limiting on webhook dispatch

**File:** `supabase/functions/webhook-dispatch/index.ts`

If a user sends many messages rapidly, each triggers a webhook dispatch. There's no deduplication or rate limiting for the receiving agent endpoint. A chatty conversation could flood an agent's webhook endpoint.

**Fix:** Consider adding a check: skip dispatch if the same agent received a webhook for the same conversation within the last N seconds.

**Severity:** MEDIUM — could overwhelm agent endpoints.

---

### M4. `agentMembers` query fetches ALL non-sender members, not just agents

**File:** `supabase/functions/webhook-dispatch/index.ts:215-219`

```ts
const { data: agentMembers } = await supabase
  .from("conversation_members")
  .select("user_id")
  .eq("conversation_id", conversationId)
  .neq("user_id", senderId);
```

This gets all members except the sender, then later filters by `agent_configs`. For group conversations with many human members, this is wasteful. Could join with `agent_configs` directly.

**Fix:** Use a single query that joins `conversation_members` with `agent_configs`:
```ts
const { data: agentConfigs } = await supabase
  .from("agent_configs")
  .select("id, user_id, webhook_url, webhook_secret, is_webhook_active")
  .eq("is_webhook_active", true)
  .in("user_id",
    supabase.from("conversation_members")
      .select("user_id")
      .eq("conversation_id", conversationId)
      .neq("user_id", senderId)
  );
```

Or use a single RPC/SQL query. Current approach works but involves two sequential queries.

**Severity:** MEDIUM — performance inefficiency, not a bug.

---

### M5. Webhook logs page missing `fetchLogs` in useEffect dependencies

**File:** `src/app/admin/webhooks/page.tsx:130-140`

The `autoRefresh` effect uses `refresh` (which is `fetchLogs(false)`) in `setInterval`. If `refresh` identity changes (which it does when `offset` changes via `useCallback` deps), the interval won't pick up the new reference.

**Severity:** MEDIUM — auto-refresh could use stale fetch function.

---

## Low Priority

### L1. Non-null assertions on `config!` in event handlers

**File:** `src/components/admin/agent-webhook-actions.tsx:41,47`

```ts
await onToggle(userId, !config!.is_webhook_active);
```

The early return on line 38 (`if (!config) return null`) makes this safe at runtime, but TypeScript non-null assertions are a code smell. The closure captures `config` which could theoretically become undefined.

**Fix:** Add a guard in the handler:
```ts
async function handleToggle() {
  if (!config) return;
  await onToggle(userId, !config.is_webhook_active);
}
```

**Severity:** LOW — works correctly but fragile pattern.

---

### L2. `alert()` used for error display

**Files:** `src/app/admin/page.tsx:118,133` and `src/components/admin/agent-webhook-actions.tsx:53`

`alert()` blocks the UI thread and is a poor UX pattern. Consider using a toast/snackbar component consistent with the rest of the app.

**Severity:** LOW — functional but poor UX.

---

### L3. Seed data contains hardcoded webhook secret

**File:** `scripts/seed.ts:138`

```ts
webhook_secret: "whsec_test_claude_001",
```

This is fine for dev seeding but document that this is a test-only value.

**Severity:** LOW — dev-only concern.

---

## Edge Cases Found by Scouting

1. **Agent-to-agent loop in group chats**: If two agents are in the same group and Agent A responds to a human message, Agent A's message insert triggers `notify_webhook_dispatch`. The trigger correctly checks `is_agent` on the sender and returns early — loop prevention works.

2. **Deactivated webhook + active agent**: An agent with `is_webhook_active = false` won't receive dispatches (query filters on line 231). Correct.

3. **Deleted user cascade**: `ON DELETE CASCADE` on both tables means deleting a user removes their config and logs. This is appropriate.

4. **Concurrent message inserts**: Multiple human messages in quick succession each trigger independent dispatches. No deduplication — could result in out-of-order webhook deliveries. Not a bug but worth documenting for agent developers.

5. **Missing `is_admin()` policy for service_role**: The Edge Function uses `service_role` key which bypasses RLS. Insert into `webhook_delivery_logs` works. Correct.

---

## Positive Observations

- Clean trigger-based loop prevention — checking `is_agent` at DB level is the right approach
- HMAC signature implementation follows standard patterns (webhook-id + timestamp + payload)
- RLS policies are correctly scoped to admin-only
- Good use of `Promise.allSettled` for parallel dispatch — one agent failure doesn't block others
- Hooks-first pattern maintained consistently
- `AbortController` timeout on fetch — correct pattern for Deno
- `tsconfig.json` exclude for `supabase/functions` prevents Deno/Node type conflicts
- File naming follows kebab-case convention
- `WebhookLogWithDetails` type properly extends base type with joins
- Seed data uses `upsert` with `onConflict` for idempotent seeding
- `Suspense` boundary on webhooks page for `useSearchParams` — Next.js 14+ requirement

---

## Recommended Actions (Priority Order)

1. **[CRITICAL]** Fix `webhook_secret` exposure — use explicit select columns in `useAgentConfigs`
2. **[CRITICAL]** Add SSRF protection — validate URL scheme in Edge Function before fetch
3. **[HIGH]** Fix the `pg_notify` / Edge Function invocation gap — use Database Webhook or `pg_net`
4. **[HIGH]** Fix `loadMore` pagination race condition in `useWebhookLogs`
5. **[HIGH]** Fix missing `fetchLogs` dependency in `useEffect`
6. **[HIGH]** Split `admin/page.tsx` into smaller components (under 200 LOC)
7. **[MEDIUM]** Reduce retry delays or implement async retry to avoid Edge Function timeout
8. **[MEDIUM]** Return inserted user ID from insert instead of re-querying by token
9. **[MEDIUM]** Consider rate limiting / deduplication for rapid messages

---

## Metrics

| Metric | Value |
|--------|-------|
| Files reviewed | 10 |
| Total LOC | 1,671 |
| Files over 200 LOC | 2 (admin/page.tsx: 341, webhooks/page.tsx: 281) |
| Critical issues | 2 |
| High issues | 4 |
| Medium issues | 5 |
| Low issues | 3 |

---

## Unresolved Questions

1. How is the Edge Function actually invoked? The `pg_notify` in the trigger does not automatically call a Supabase Edge Function. Is there a Supabase Database Webhook configured in the dashboard that was not included in this review?
2. Is there a plan for webhook secret rotation? Currently updating the secret requires the admin to coordinate with the agent developer.
3. Should `webhook_delivery_logs` have a TTL / cleanup policy to prevent unbounded growth?
