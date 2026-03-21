# Code Review: Version Reload - API Routes & Hook Logic

**PR:** #20
**Branch:** `feat/version-reload-missing-files`
**Reviewer:** code-reviewer
**Date:** 2026-03-19
**Focus:** API routes and hook logic

---

## Scope

| File | LOC | Type |
|------|-----|------|
| `src/app/api/release-notify/route.ts` | 47 | New - webhook endpoint |
| `src/app/api/version/route.ts` | 8 | New - version check endpoint |
| `src/hooks/use-version-check.ts` | 64 | New - client hook |
| `src/components/ui/update-banner.tsx` | 37 | New - UI component |
| `src/app/chat/layout.tsx` | ~4 lines changed | Integration |

---

## Overall Assessment

Solid implementation. The webhook auth uses timing-safe comparison correctly, the hook has proper cleanup, and the overall architecture (broadcast + polling fallback) is well-designed. A few issues worth addressing below.

---

## Critical Issues

None.

---

## Warning (High Priority)

### W1. Non-null assertions on env vars in release-notify route

**File:** `src/app/api/release-notify/route.ts:31-33`

```ts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
```

If `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is not set, this will throw an unhandled exception at runtime, returning a 500 with potential stack trace leakage. The route already validates `webhookSecret` gracefully but crashes on these.

**Fix:** Guard or return 500 explicitly:
```ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
}
const supabase = createClient(supabaseUrl, serviceRoleKey);
```

**Severity:** Warning -- runtime crash on misconfiguration, 500 with no useful error message.

### W2. Supabase client created on every request in release-notify

**File:** `src/app/api/release-notify/route.ts:31`

A new Supabase client is instantiated on every POST. For a webhook that fires infrequently (on release), this is acceptable. However, the Supabase JS client establishes a WebSocket connection internally for realtime features. Creating and abandoning clients could leak connections if the runtime keeps the process warm (e.g., Vercel serverless with warm starts).

**Fix (optional):** Move client creation to module scope or use a lazy singleton:
```ts
let _supabase: ReturnType<typeof createClient> | null = null;
function getServiceClient() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}
```

**Severity:** Warning -- potential connection leak on warm serverless instances.

### W3. Supabase channel not unsubscribed server-side after broadcast

**File:** `src/app/api/release-notify/route.ts:36`

`supabase.channel("app-releases").send(...)` subscribes to the channel to send the broadcast but never calls `channel.unsubscribe()` afterward. On a long-lived server or warm serverless function, this leaves an open subscription.

**Fix:** Unsubscribe after sending:
```ts
const channel = supabase.channel("app-releases");
const result = await channel.send({ ... });
await supabase.removeChannel(channel);
```

**Severity:** Warning -- resource leak on warm instances.

---

## Medium Priority

### M1. No initial version check on mount in the hook

**File:** `src/hooks/use-version-check.ts:50`

The polling effect only runs `setInterval` -- it does not call `poll()` immediately. Users will not see the banner until either:
- A broadcast arrives via Supabase realtime, OR
- 5 minutes elapse for the first poll tick

If the user loads the app after a deploy but before the CI webhook fires, they sit on stale code for up to 5 minutes with no notification.

**Fix:** Call `poll()` once immediately:
```ts
poll(); // initial check
const intervalId = setInterval(poll, POLL_INTERVAL_MS);
```

**Severity:** Medium -- delayed notification after deploy.

### M2. `showBanner` is derived but not memoized

**File:** `src/hooks/use-version-check.ts:61`

```ts
const showBanner = newVersion !== null && !dismissed;
```

This is recomputed on every render. It's cheap, but since the hook returns an object literal on every call, the parent component (`ChatLayoutContent`) will re-render on every state change in the layout. This is fine for now since the layout already re-renders frequently, but worth noting.

**Severity:** Medium -- minor; no action needed unless profiling shows issues.

### M3. Version comparison is string-based, not semver

**File:** `src/hooks/use-version-check.ts:15`

```ts
if (version !== BUILD_VERSION && version !== "unknown") {
```

This uses strict string inequality. If the API returns `"1.7.0"` and `BUILD_VERSION` is `"1.7.0"` but with different whitespace or prefix (e.g., `"v1.7.0"` vs `"1.7.0"`), the banner shows incorrectly. Also, a rollback to an older version would show the banner (version differs but is actually older).

**Current risk is low** since `NEXT_PUBLIC_APP_VERSION` comes from `package.json` version and the webhook also sends a clean version string. But worth documenting as an assumption.

**Severity:** Medium -- fragile if version format conventions change.

---

## Low Priority (Info/Nitpick)

### I1. `/api/version` endpoint is publicly accessible

**File:** `src/app/api/version/route.ts`

No authentication. Anyone can query `/api/version` to learn the exact deployed version. This is standard for most apps (version is often in HTML meta tags anyway), but if version disclosure is a concern, consider rate-limiting or adding auth.

**Severity:** Info -- acceptable for most projects.

### I2. Error response body on unauthorized includes "Unauthorized" text

**File:** `src/app/api/release-notify/route.ts:24`

The error message `"Unauthorized"` is returned for both missing secret AND wrong secret. This is correct (no information leakage about whether the secret was close or missing). Good practice.

**Severity:** Info -- positive observation.

### I3. `dismissed` state resets on re-mount

**File:** `src/hooks/use-version-check.ts:11-12`

`dismissed` is `useState(false)` and `dismissedVersion` is a ref. If the layout unmounts and remounts (route change, etc.), the dismissed state resets and the banner reappears. The `dismissedVersion` ref also resets. Consider `sessionStorage` if persistent dismiss across navigations is desired.

**Severity:** Low -- depends on UX requirements.

---

## Edge Cases Found by Scout

1. **Race between broadcast and poll:** If broadcast fires and poll also fires at roughly the same time, `handleNewVersion` is called twice with the same version. This is safe -- `setNewVersion` is idempotent for the same value and React batches state updates. No issue.

2. **Multiple tabs:** Each tab creates its own Supabase broadcast subscription and polling interval. All tabs will show the banner independently. Dismissing in one tab does not dismiss in others. This is acceptable behavior but worth noting.

3. **`BUILD_VERSION` is "unknown":** If `NEXT_PUBLIC_APP_VERSION` is not set, `BUILD_VERSION` is `"unknown"`. The `handleNewVersion` check `version !== "unknown"` prevents showing a banner when the incoming version is unknown, but does NOT prevent showing a banner when `BUILD_VERSION` is unknown and any real version comes in. This means a misconfigured deploy would show the banner for every broadcast. Acceptable edge case.

4. **Webhook replay / duplicate calls:** If CI calls `/api/release-notify` multiple times with the same version (retry logic), each call broadcasts. The client handles this gracefully (same version = no-op). No issue.

5. **Supabase realtime disconnection:** If Supabase realtime drops (network issue), the polling fallback at 5-minute intervals still works. Good resilience design.

---

## Positive Observations

- **Timing-safe comparison** for webhook secret is correct and uses `Buffer.from` with length pre-check to avoid timing leaks on length differences.
- **Dual delivery mechanism** (broadcast + polling) provides good resilience.
- **Proper cleanup** in both `useEffect` hooks (unsubscribe + clearInterval).
- **`useCallback` + ref pattern** for dismissed version avoids stale closure bugs.
- **No-store cache header** on version endpoint prevents CDN/browser caching of stale versions.
- **Clean separation** between hook logic, UI component, and API routes.

---

## Recommended Actions

1. **[W1]** Add env var guards in release-notify route before creating Supabase client
2. **[W3]** Call `supabase.removeChannel(channel)` after broadcast send
3. **[M1]** Add immediate `poll()` call on mount for faster detection
4. **[I3]** Consider `sessionStorage` for dismiss persistence (optional, UX decision)

---

## Unresolved Questions

- Is the webhook called from GitHub Actions? If so, is `RELEASE_WEBHOOK_SECRET` set in the CI environment secrets?
- Should version rollbacks (older version deployed) also trigger the banner, or only upgrades?
