# Code Review: Version Reload Feature

**Reviewer:** code-reviewer
**Date:** 2026-03-19
**Branch:** feat/read-receipts-ui (staged, uncommitted)

---

## Scope

- **Files:** 8 (4 new, 4 modified)
- **LOC:** ~120 new
- **Focus:** Security, correctness, layout impact, CI workflow, error handling

| File | Status |
|------|--------|
| `src/app/api/version/route.ts` | New |
| `src/app/api/release-notify/route.ts` | New |
| `src/hooks/use-version-check.ts` | New |
| `src/components/ui/update-banner.tsx` | New |
| `next.config.ts` | Modified |
| `src/app/chat/layout.tsx` | Modified |
| `.github/workflows/ci.yml` | Modified |
| `.env.example` | Modified |

---

## Overall Assessment

Clean, well-structured feature. Dual-channel detection (realtime broadcast + polling fallback) is a solid pattern. Layout integration is non-invasive. Two security issues need attention; the rest is polish.

---

## Critical Issues

### C1. Timing attack on webhook secret comparison

**File:** `src/app/api/release-notify/route.ts:8`

```ts
if (!secret || secret !== process.env.RELEASE_WEBHOOK_SECRET) {
```

String `!==` comparison is vulnerable to timing attacks. An attacker can iteratively guess the secret character-by-character by measuring response times. Use Node.js `crypto.timingSafeEqual` instead.

**Fix:**
```ts
import { timingSafeEqual } from "crypto";

const expected = process.env.RELEASE_WEBHOOK_SECRET;
if (!secret || !expected ||
    Buffer.byteLength(secret) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(secret), Buffer.from(expected))) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Severity:** Critical — this is a publicly accessible endpoint.

### C2. Unhandled JSON parse error in release-notify

**File:** `src/app/api/release-notify/route.ts:6`

```ts
const body = await request.json();
```

If the request body is not valid JSON, `request.json()` throws and returns a 500 with potentially leaky stack trace. Wrap in try-catch.

**Fix:**
```ts
let body: Record<string, unknown>;
try {
  body = await request.json();
} catch {
  return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
}
```

**Severity:** Critical — unhandled exception on a public endpoint, information leakage risk.

---

## High Priority

### H1. Supabase broadcast result not checked

**File:** `src/app/api/release-notify/route.ts:21-25`

```ts
await supabase.channel("app-releases").send({...});
```

The `send` call could fail (e.g., Supabase outage, misconfigured service role key). The endpoint returns `{ ok: true }` regardless. Check the result and return an appropriate status.

**Fix:**
```ts
const result = await supabase.channel("app-releases").send({
  type: "broadcast",
  event: "new-version",
  payload: { version },
});

if (result !== "ok") {
  return NextResponse.json({ error: "Broadcast failed" }, { status: 502 });
}
```

### H2. `NEXT_PUBLIC_APP_VERSION` is baked at build time

**File:** `next.config.ts:8`, `src/hooks/use-version-check.ts:7`

`NEXT_PUBLIC_APP_VERSION` is set from `package.json` at build time and inlined into the client bundle. The `/api/version` endpoint runs server-side but also reads `process.env.NEXT_PUBLIC_APP_VERSION` which was set at build time via `next.config.ts env` block.

**Edge case:** If the deployment platform caches the build and the version endpoint is served from a different build than the client, version comparison could falsely trigger or miss updates. This is inherent to Next.js `env` config and is acceptable — just documenting the assumption that client and API are deployed atomically.

No fix needed. Just be aware.

### H3. No initial poll on mount

**File:** `src/hooks/use-version-check.ts:48`

The polling effect only sets up `setInterval` — it does not run an initial poll. If the user opens the tab after a release (and misses the broadcast), they won't see the banner for up to 5 minutes.

**Fix:** Add an immediate poll call before the interval:
```ts
useEffect(() => {
  const poll = async () => { /* ... */ };
  poll(); // Run immediately on mount
  const intervalId = setInterval(poll, POLL_INTERVAL_MS);
  return () => clearInterval(intervalId);
}, [handleNewVersion]);
```

---

## Medium Priority

### M1. Dismissed state resets on new broadcast

**File:** `src/hooks/use-version-check.ts:16`

```ts
setDismissed(false);
```

If the user dismisses the banner, a subsequent broadcast for the **same version** will re-show it because `handleNewVersion` resets `dismissed`. The `version !== BUILD_VERSION` check prevents this for the same version, but if CI retries the webhook, the same version fires again and banner reappears.

Consider storing the dismissed version:
```ts
const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
// In handleNewVersion:
if (version !== BUILD_VERSION && version !== "unknown" && version !== dismissedVersion) {
  setNewVersion(version);
}
```

### M2. `RELEASE_WEBHOOK_SECRET` env var not validated at startup

**File:** `src/app/api/release-notify/route.ts`

If `RELEASE_WEBHOOK_SECRET` is unset, the `!secret` check catches it — but `process.env.RELEASE_WEBHOOK_SECRET` is `undefined`, so the comparison `secret !== undefined` would fail for any non-empty string. This means the endpoint effectively rejects all requests when the secret is unset, which is safe. However, logging a warning would help operators debug misconfiguration.

### M3. Version endpoint has no caching headers

**File:** `src/app/api/version/route.ts`

Every poll creates a new request. For deployments behind a CDN, adding `Cache-Control: no-store` explicitly prevents stale cached responses from masking new versions.

**Fix:**
```ts
return NextResponse.json(
  { version: process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown" },
  { headers: { "Cache-Control": "no-store" } },
);
```

---

## Low Priority

### L1. Channel not cleaned up in release-notify

**File:** `src/app/api/release-notify/route.ts:21`

`supabase.channel("app-releases")` creates a channel instance that is never unsubscribed. In a serverless context this is fine (function dies after response), but in a long-running server it would accumulate orphaned channel objects. Consider using `supabase.channel("app-releases").send(...)` then immediately removing.

### L2. Banner color could use design tokens

**File:** `src/components/ui/update-banner.tsx:13`

Hardcoded `bg-sky-50`, `border-sky-200`, `text-sky-800` — consistent with the Toaster info style in the layout, which is good. But if design tokens change, these would drift. Minor concern.

---

## CI Workflow Analysis

### Correct

- Version detection via before/after comparison is solid — avoids parsing semantic-release output
- `steps.release.outputs.version != ''` guard correctly skips notify when no release
- `|| echo "Release notification failed (non-fatal)"` with `-sf` flag means curl fails silently on HTTP errors but pipeline continues — correct for non-blocking notification

### Potential Issue

- **Secret availability:** `APP_URL` and `RELEASE_WEBHOOK_SECRET` must be set as GitHub Actions secrets. If `APP_URL` is unset, `curl` will fail with an invalid URL — the `|| echo` fallback handles this gracefully. No action needed, but document required secrets in README.

---

## Edge Cases Found by Scout

1. **Race: rapid successive releases** — If two releases happen back-to-back, the second broadcast arrives while the user is viewing the banner for the first. `handleNewVersion` overwrites `newVersion` and resets `dismissed` — correct behavior, user sees latest version.

2. **Tab backgrounded** — `setInterval` is throttled by browsers when tab is backgrounded (~1 min minimum). The Supabase realtime channel remains connected, so broadcast still fires. Acceptable.

3. **BUILD_VERSION is "unknown"** — If build runs without `package.json` version (unlikely), both client and server return "unknown". The `version !== "unknown"` guard in `handleNewVersion` prevents showing a banner for unknown versions. Correct.

4. **Supabase realtime disconnection** — If the browser loses realtime connection, the polling fallback covers it within 5 minutes. Dual-channel design is resilient.

5. **Mobile sidebar + banner** — Banner is rendered above the `flex-1 min-h-0` container. Mobile overlay uses `fixed inset-0 z-40`, banner is in normal flow. No z-index conflict. The banner pushes content down correctly via flexbox.

---

## Positive Observations

- Clean separation: API route, hook, and UI component are each focused and small
- Dual detection strategy (realtime + polling) provides good resilience
- Banner UI is accessible: has `aria-label` on dismiss button, uses semantic layout
- CI version detection approach is elegant — no fragile regex on semantic-release output
- Non-blocking CI notification (failure doesn't break pipeline)
- `.env.example` includes generation hint for the secret

---

## Recommended Actions

1. **[Critical]** Add timing-safe comparison for webhook secret (C1)
2. **[Critical]** Add try-catch around `request.json()` (C2)
3. **[High]** Check Supabase broadcast result (H1)
4. **[High]** Add initial poll on mount (H3)
5. **[Medium]** Track dismissed version to prevent re-show on duplicate broadcasts (M1)
6. **[Medium]** Add `Cache-Control: no-store` to version endpoint (M3)
7. **[Low]** Document required GitHub Actions secrets (`APP_URL`, `RELEASE_WEBHOOK_SECRET`)

---

## Metrics

- **Type Coverage:** 100% — all new code is fully typed, typecheck passes
- **Test Coverage:** N/A — no tests for this feature (acceptable for UI + API glue)
- **Linting Issues:** 0 — `tsc --noEmit` clean

---

## Unresolved Questions

1. Should the version check hook be active on all pages or just `/chat/*`? Currently scoped to chat layout only — fine if that's the only SPA surface.
2. Is `SUPABASE_SERVICE_ROLE_KEY` available in the production runtime environment? The release-notify endpoint requires it. If the app runs on Vercel/serverless, confirm this env var is set.
