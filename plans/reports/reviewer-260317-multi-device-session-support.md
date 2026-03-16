# Code Review: Multi-Device Session Support

**Date:** 2026-03-17
**Reviewer:** code-reviewer
**Scope:** 8 files (1 migration, 7 TS/TSX)
**Focus:** Correctness, security, edge cases

---

## Overall Assessment

Solid feature structure. Clean separation between server-side session management (service role) and client-side auth. However, there are **2 critical issues** and several high-priority concerns that need resolution before merge.

---

## Critical Issues

### C1. `admin.signOut()` receives wrong value — kicked sessions NOT actually invalidated

**File:** `src/app/api/auth/login/route.ts:40`

```ts
await supabase.auth.admin.signOut(oldestSession.supabase_session_id);
```

The Supabase `GoTrueAdminApi.signOut(jwt: string, scope?: SignOutScope)` expects a **JWT access_token**, not a custom hashed identifier. The code stores a SHA-256 hash of the refresh_token (lines 160-165):

```ts
const supabaseSessionId = signInData.session?.access_token
  ? createHash("sha256")
      .update(signInData.session.refresh_token)
      .digest("hex")
      .slice(0, 32)
  : null;
```

This hashed value is NOT a valid JWT. When `enforceSessionCap` calls `admin.signOut(hashedValue)`, the call will silently fail (caught by the empty `catch` block on line 41), and the **kicked user's session remains valid** — they can keep making authenticated requests.

**Impact:** Session cap enforcement is cosmetic only. The oldest session's Supabase auth is never actually revoked. The user_sessions row is deleted, but the real JWT/refresh_token pair remains active.

**Fix:** Store the actual `access_token` (or use `admin.signOut` with the JWT). Alternatively, if you want to revoke by user rather than by session, use `admin.updateUserById(userId, { ban_duration: ... })` or invalidate all refresh tokens. Best approach: store the actual access_token or, better, use the Supabase session ID from `signInData.session.id` if available, but note the admin API wants a JWT.

**Recommended approach:**
1. Store `signInData.session.access_token` as `supabase_session_id` (rename column to `supabase_access_token` for clarity).
2. Pass that JWT to `admin.signOut()`.
3. Note: access tokens expire (default 1h). For long-lived revocation, also consider storing the refresh_token and calling token revocation, or simply rely on the access_token expiry + deleting the session record (so middleware won't refresh it).

---

### C2. Race condition on session cap — no atomicity

**File:** `src/app/api/auth/login/route.ts:20-52`

`enforceSessionCap` does: SELECT count -> if >= 3 -> DELETE oldest -> then caller INSERTs. This is a classic TOCTOU (time-of-check-time-of-use) race. If two logins for the same user hit simultaneously:

1. Login A reads 2 sessions, proceeds (no cap hit)
2. Login B reads 2 sessions, proceeds (no cap hit)
3. Both insert -> user now has 4 sessions

**Impact:** Session cap can be exceeded under concurrent login.

**Fix options:**
- **Option A (recommended):** Wrap the check + delete + insert in a Postgres function (`enforce_session_cap(user_id, max_sessions)`) that uses `FOR UPDATE` row locking:
  ```sql
  CREATE OR REPLACE FUNCTION enforce_session_cap(p_user_id uuid, p_max int)
  RETURNS TABLE(kicked_device text, kicked_at timestamptz) AS $$
  BEGIN
    -- Lock rows for this user
    PERFORM id FROM user_sessions WHERE user_id = p_user_id FOR UPDATE;
    -- Delete overflow
    RETURN QUERY
      DELETE FROM user_sessions
      WHERE id IN (
        SELECT id FROM user_sessions
        WHERE user_id = p_user_id
        ORDER BY last_active_at ASC
        LIMIT GREATEST(0, (SELECT count(*) FROM user_sessions WHERE user_id = p_user_id) - p_max + 1)
      )
      RETURNING device_name AS kicked_device, last_active_at AS kicked_at;
  END;
  $$ LANGUAGE plpgsql;
  ```
- **Option B:** Add a partial unique index or use advisory locks.
- **Option C (simplest):** Accept the race as unlikely for 3-device consumer use. Document the decision. The worst case (4 sessions) self-corrects on next login.

---

## High Priority

### H1. Middleware creates a new service client on EVERY request

**File:** `src/lib/supabase/middleware.ts:56-59`

```ts
const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

This instantiates a new Supabase client on every middleware invocation. Middleware runs on every matched route.

**Impact:** Extra object allocation per request. While Supabase JS client is lightweight, this is wasteful.

**Fix:** Use a module-level singleton like the login route does:

```ts
let serviceClient: ReturnType<typeof createClient> | null = null;
function getServiceClient() {
  if (!serviceClient) {
    serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return serviceClient;
}
```

### H2. Logout deletes ALL sessions for the user, not just the current one

**File:** `src/lib/auth.ts:57`

```ts
await supabase.from("user_sessions").delete().eq("user_id", user.id);
```

This deletes **every** session row for the user. If a user is logged in on 3 devices and logs out from one, all 3 session records are wiped. The other 2 devices lose their `last_active_at` tracking (though their Supabase auth remains valid since the JWT isn't revoked).

**Fix:** Delete only the current session using the `session_record_id` cookie:

```ts
export async function logout() {
  const supabase = createBrowserSupabaseClient();
  // Read session_record_id from cookie (httpOnly — need server action or API route)
  // OR: use the user's RLS-scoped delete with a filter
  // Simplest: delete by matching current session info
  await supabase.auth.signOut();
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}
```

**Problem:** The `session_record_id` cookie is `httpOnly: true`, so client JS cannot read it. Options:
1. Make an API route `POST /api/auth/logout` that reads the cookie and deletes the specific row.
2. Make the cookie non-httpOnly (less secure, but acceptable for a non-sensitive session tracker).
3. Store session_record_id in a non-httpOnly cookie or localStorage alongside the httpOnly one.

### H3. `signInWithPassword` on admin client pollutes admin client session state

**File:** `src/app/api/auth/login/route.ts:144-148`

```ts
const { data: signInData, error: signInError } =
  await getSupabaseAdmin().auth.signInWithPassword({
    email,
    password,
  });
```

`signInWithPassword` is called on the **service role** client singleton. This sets session state on the admin client's internal auth state. Subsequent requests reuse this singleton, meaning the admin client may carry stale session state from a previous login request.

**Impact:** Potential auth state pollution between different users' login requests. One user's session could leak into another request's context.

**Fix:** Create a **fresh ephemeral client** (not the admin singleton) for `signInWithPassword`:

```ts
const ephemeralClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const { data: signInData } = await ephemeralClient.auth.signInWithPassword({
  email,
  password,
});
```

Or use `admin.generateLink` to create a session without polluting client state.

---

## Medium Priority

### M1. No validation on `session_record_id` cookie value

**File:** `src/lib/supabase/middleware.ts:51-52`

The middleware reads `session_record_id` from cookie and uses it directly in a DB query without validating it's a valid UUID. A malformed value would simply fail the `.eq("id", ...)` filter, but it's sloppy.

**Fix:** Add UUID validation or at minimum a length check.

### M2. `enforceSessionCap` runs AFTER `signInWithPassword` — new session already active

**File:** `src/app/api/auth/login/route.ts:157`

The flow is: sign in (creates Supabase session) -> enforce cap (kick oldest). This means during the window between sign-in and cap enforcement, the user has N+1 active Supabase sessions. If the server crashes between these steps, a dangling Supabase session exists with no `user_sessions` record.

**Fix:** Enforce cap BEFORE sign-in, or accept the brief inconsistency window with a cleanup cron.

### M3. `session_record_id` cookie not cleared on logout

**File:** `src/lib/auth.ts:49-62`

The logout function doesn't clear the `session_record_id` cookie. It persists as a stale orphan until expiry (30 days). On next login, middleware will try to update a non-existent session row.

**Fix:** Add cookie clearing in the logout flow (requires server-side route since it's httpOnly).

### M4. Missing `NOT NULL` constraint on `supabase_session_id`

**File:** `supabase/migrations/013_user_sessions.sql:7`

`supabase_session_id text` is nullable. The code sets it to `null` when `access_token` is missing (line 160-165 of login route). This means sessions can exist without any Supabase session reference, making them impossible to revoke via `admin.signOut`.

**Consider:** Whether this should be `NOT NULL` — if a session can't be revoked, should it be tracked?

---

## Low Priority

### L1. `formatRelativeTime` doesn't handle future dates or invalid input

**File:** `src/lib/session-utils.ts:15-23`

If `dateStr` is in the future (clock skew) or invalid, the function returns negative/NaN values like `-3m ago`.

### L2. Fire-and-forget DB update in middleware has no error logging

**File:** `src/lib/supabase/middleware.ts:60-65`

`.then(() => {})` swallows all errors. Add `.catch(console.error)` at minimum for debugging.

### L3. Magic string `"agent_playground_token"` duplicated

**File:** `src/lib/auth.ts:4` and `src/app/login/page.tsx:33`

The login page directly references `"agent_playground_token"` instead of using the `TOKEN_STORAGE_KEY` constant from `auth.ts`.

---

## Positive Observations

- Clean separation: service role for writes, RLS for reads/deletes
- No INSERT RLS policy — correctly forces inserts through service role only
- Debounced `last_active_at` update (5-minute window) is a good optimization
- Device name parsing via ua-parser-js is pragmatic
- Kicked session notification via sessionStorage + toast is a nice UX pattern
- Type safety with explicit interfaces (`UserSession`, `KickedSession`)
- Singleton pattern for admin client in login route

---

## Recommended Actions (Priority Order)

1. **[CRITICAL]** Fix `admin.signOut()` to pass actual JWT, not hashed value
2. **[CRITICAL]** Address race condition (at minimum document it; ideally use PG function with row locks)
3. **[HIGH]** Use ephemeral client for `signInWithPassword` to avoid session state pollution
4. **[HIGH]** Fix logout to delete only current session, not all sessions
5. **[HIGH]** Singleton the service client in middleware
6. **[MEDIUM]** Clear `session_record_id` cookie on logout
7. **[MEDIUM]** Move cap enforcement before sign-in
8. **[LOW]** Fix magic string duplication, add error logging to middleware update

---

## Unresolved Questions

1. **Access token expiry vs session revocation:** If access tokens expire in 1h (Supabase default), do we need `admin.signOut` at all? The refresh token is what keeps sessions alive. Should we store and revoke refresh tokens instead?
2. **Session cleanup:** What happens to orphaned `user_sessions` rows when a Supabase session expires naturally (user doesn't explicitly log out)? A periodic cleanup job may be needed.
3. **Agent users:** Should agent (bot) users be exempt from the 3-session cap? They might legitimately need more concurrent connections.
