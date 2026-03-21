# Code Review: GoClaw Webhook Bridge Integration

**Date:** 2026-03-21
**Branch:** `feat/goclaw-integration`
**Reviewer:** code-reviewer

---

## Scope

- **Files:** 8 (bridge route, test route, hook, types, form component, admin page, migration, env)
- **LOC:** ~500 new/modified
- **Focus:** Security, error handling, type safety, SSRF, auto-fill UX, response format

---

## Overall Assessment

**Solid implementation.** The bridge route is well-structured with 12+ distinct error paths, proper timeout handling, and good logging discipline (no secrets in logs). The webhook-dispatch Edge Function already has SSRF protection. The admin UI auto-fill UX is thoughtful with flash animation and manual-override tracking.

A few security and robustness issues need attention.

---

## Critical Issues

### 1. SSRF: Bridge route does not validate GOCLAW_URL

**File:** `src/app/api/goclaw/bridge/route.ts` (line 219)

The bridge fetches `${GOCLAW_URL}/v1/chat/completions` where `GOCLAW_URL` comes from env. While env-controlled, if misconfigured (e.g., `http://169.254.169.254` or internal metadata endpoint), the server-side fetch could hit cloud metadata services.

**Impact:** Low likelihood (requires env misconfiguration) but high severity if exploited.

**Fix:** Validate `GOCLAW_URL` at startup — must be HTTPS, must not resolve to private/link-local ranges. The `isValidWebhookUrl()` function in webhook-dispatch already does this; reuse it.

```typescript
// At module level, after GOCLAW_URL assignment
if (GOCLAW_URL && !isValidUrl(GOCLAW_URL)) {
  console.error("[bridge] FATAL: GOCLAW_URL is not a valid HTTPS URL");
}
```

### 2. Timing-safe comparison missing for webhook_secret auth

**File:** `src/app/api/goclaw/bridge/route.ts` (line 122)

```typescript
const matchedConfig = configs?.find((config) => config.webhook_secret === bearerToken);
```

Direct string comparison is vulnerable to timing attacks. An attacker could measure response times to incrementally guess the secret.

**Impact:** Medium. The secret space is large, but this is a well-known antipattern for auth tokens.

**Fix:** Use `crypto.timingSafeEqual` (available in Node.js/Edge runtime):

```typescript
import { timingSafeEqual } from "crypto";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
```

---

## High Priority

### 3. Redundant 3rd DB query after agent already found

**File:** `src/app/api/goclaw/bridge/route.ts` (lines 110-161)

The bridge queries `agent_configs` up to 3 times:
1. Lines 111-126: Find agent by user_id candidates + secret match (already selects `metadata`)
2. Lines 130-144: Fallback query by secret (already selects `metadata`)
3. Lines 152-156: Re-query same agent by user_id to get `metadata`

Query #3 is redundant — the matched config from query #1 or #2 already contains `metadata`.

**Fix:** Store the matched config object and skip the third query:

```typescript
let matchedConfig: { user_id: string; webhook_secret: string; metadata: unknown } | null = null;

// ... in primary query ...
matchedConfig = configs?.find(c => safeCompare(c.webhook_secret, bearerToken)) ?? null;

// ... in fallback ...
if (!matchedConfig && allConfigs?.length) matchedConfig = allConfigs[0];

if (!matchedConfig) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const agentId = matchedConfig.user_id;
const metadata = (matchedConfig.metadata || {}) as Record<string, unknown>;
```

Saves ~5ms per request and removes a race condition where config could be deleted between query #1 and #3.

### 4. useEffect missing dependencies (React lint warning)

**File:** `src/components/admin/webhook-config-form.tsx` (line 64)

```typescript
useEffect(() => { ... }, [goclawAgentKey]);
```

The effect reads `webhookUrl`, `healthCheckUrl`, `autoFilledFields`, `onUrlChange`, `onHealthCheckUrlChange` but they are not in the dependency array. This is intentional (only trigger on key change) but will cause ESLint `react-hooks/exhaustive-deps` warnings.

**Fix:** Either suppress with `// eslint-disable-next-line react-hooks/exhaustive-deps` or use refs for the callback props.

### 5. `sender` field not validated in bridge

**File:** `src/app/api/goclaw/bridge/route.ts` (line 88)

```typescript
if (!message?.content || !conversationId || !messageId) {
```

The `sender` field is not validated but is used in `buildSystemPrompt` (line 201) and message content (line 209). If `sender` is undefined, system prompt becomes `"...conversation with undefined"`.

**Fix:** Add `!sender` to the validation check.

---

## Medium Priority

### 6. Test connection tests GoClaw server, not the specific agent

**File:** `src/app/admin/page.tsx` (line 787) + `src/app/api/goclaw/test/route.ts`

The "Test Connection" button hits `/api/goclaw/test` which just pings `GOCLAW_URL/health`. It does not verify:
- The specific `goclaw_agent_key` exists in GoClaw
- The `GOCLAW_GATEWAY_TOKEN` is valid

This gives false confidence — server is up but agent might not exist.

**Suggestion:** Consider an optional `/v1/models` or similar endpoint check that validates the agent key. Low priority since GoClaw would return an error on first real message anyway.

### 7. webhook_secret check at line 163 is dead code for the current flow

**File:** `src/app/api/goclaw/bridge/route.ts` (line 163)

```typescript
if (!agentConfig.webhook_secret) {
  return NextResponse.json({ error: "GoClaw agents require webhook_secret" }, { status: 400 });
}
```

By this point, `agentConfig` was already matched by `webhook_secret === bearerToken` (line 122) or selected from fallback query where secret matched. So `webhook_secret` is guaranteed non-null. This check is defensive but unreachable in current flow.

**Note:** Keep it as defense-in-depth, but document why.

### 8. `metadata` column default vs existing rows

**File:** `supabase/migrations/023_agent_configs_metadata.sql`

```sql
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
```

Existing rows will get `NULL` (not `'{}'`) because `DEFAULT` only applies to new inserts, not existing rows. The code handles this correctly with `agentConfig.metadata || {}`, but worth documenting.

**Suggestion:** Add a backfill in the migration:

```sql
ALTER TABLE agent_configs ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
UPDATE agent_configs SET metadata = '{}'::jsonb WHERE metadata IS NULL;
```

### 9. `member.users` type assertion is fragile

**File:** `src/app/api/goclaw/bridge/route.ts` (lines 192-197)

```typescript
memberNames = members.map(
  (member: { users: { display_name: string }[] }) => {
    const userRecord = member.users[0];
    return userRecord?.display_name || "Unknown";
  },
);
```

Supabase `!inner` join returns a single object (not array) for `users`. The code treats it as an array with `[0]`. This works by coincidence because JS allows indexing objects with `[0]` returning undefined for non-arrays, falling back to "Unknown".

**Fix:** Type it correctly as a single object:

```typescript
(member: { users: { display_name: string } }) => member.users.display_name || "Unknown"
```

---

## Low Priority

### 10. `GOCLAW_AGENT_KEY_PATTERN` duplicated

The regex `/^[a-zA-Z0-9_-]*$/` appears in both `webhook-config-form.tsx` (line 6) and inline in the admin page edit dialog (line 824). Extract to a shared constant.

### 11. Auto-fill does not clear when GoClaw key is removed

**File:** `src/components/admin/webhook-config-form.tsx`

If user enters a GoClaw key (auto-fills URL), then clears the key, the auto-filled URL remains. This is acceptable UX but could confuse users who expect clearing the key to revert the URL.

### 12. Health check timeout errors return 200

**File:** `src/app/api/goclaw/test/route.ts` (line 45)

Timeout and connection errors return `{ ok: false, ... }` with HTTP 200. The client handles this correctly (checks `data.ok`), but returning 200 for errors is unconventional. Consider returning 502/504 for upstream failures.

---

## Edge Cases Found by Scout

1. **Race: Agent config deleted between auth check and metadata query** — The redundant 3rd query (issue #3) could fail if config is deleted between queries. Fix by eliminating the extra query.

2. **Group conversation with no member names** — If `conversation_members` join returns empty, `memberNames` is `[]`, system prompt says "0 members: ". Harmless but odd. Consider fallback text.

3. **Very long history** — Bridge forwards all history items without limit. Webhook-dispatch caps at 50, so this is bounded. But `mapHistoryToMessages` should document this assumption.

4. **GoClaw returns `ok: false` with HTTP 200** — Handled correctly at line 267. Good.

5. **Multiple agents in same conversation** — Webhook-dispatch dispatches to all mentioned agents. Each hits the bridge independently. No conflicts, but concurrent GoClaw calls could cause high latency for the user.

---

## Positive Observations

- **Structured logging** with webhook ID, latency, token counts — never logs secrets. Exemplary.
- **12+ error paths** all properly rescued with appropriate HTTP status codes.
- **GoClaw response format** handled correctly: `payload.content` primary, `choices[0]` fallback.
- **Auto-fill UX** is well-thought-out: tracks which fields were auto-filled vs manually edited, uses flash animation for feedback, and does not overwrite manual edits.
- **Timeout handling** with AbortController is correct. 25s bridge < 30s webhook-dispatch — proper cascade.
- **Migration is minimal** (one ALTER TABLE) and uses `IF NOT EXISTS` for idempotency.
- **`webhook-dispatch` already has SSRF protection** via `isValidWebhookUrl()`.
- **Test route** requires Supabase auth before proxying health check — prevents unauthenticated probing.

---

## Recommended Actions

1. **[Critical]** Add timing-safe comparison for webhook_secret auth (issue #2)
2. **[High]** Eliminate redundant 3rd DB query (issue #3) — saves latency + removes race
3. **[High]** Validate `sender` field in request body (issue #5)
4. **[Medium]** Fix `member.users` type to single object, not array (issue #9)
5. **[Medium]** Backfill NULL metadata in migration (issue #8)
6. **[Low]** Extract shared agent key regex constant (issue #10)
7. **[Low]** Consider GOCLAW_URL validation at startup (issue #1)

---

## Metrics

- **Type Coverage:** Good — all interfaces defined, TypeScript passes (`npx tsc --noEmit` clean)
- **Test Coverage:** No tests (per project convention — not requested)
- **Linting Issues:** 1 expected (useEffect deps in webhook-config-form.tsx)
- **Error Paths:** 12+ covered (matches plan's error registry)

---

## Unresolved Questions

1. Should the bridge validate that `GOCLAW_URL` is HTTPS at startup, or is env-level trust sufficient?
2. Should "Test Connection" verify the specific agent key exists, or is server-level health sufficient?
3. Is the `users` join in Supabase returning an object or array for `!inner`? Needs empirical check — the code may work correctly if Supabase returns an array for the relation.
