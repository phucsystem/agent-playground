# Phase 3: Middleware — Debounced last_active_at

**Priority:** Medium
**Status:** pending
**Effort:** Small

## Context

- Middleware: `src/lib/supabase/middleware.ts`
- Need to keep `last_active_at` updated for session ordering

## Overview

Update the Supabase middleware to debounce-update `last_active_at` on `user_sessions` for the current session. Only update if last value is > 5 minutes old to minimize DB writes.

## Requirements

- Identify current session in middleware (via JWT or session cookie)
- Update `last_active_at` only if stale (> 5 minutes)
- Non-blocking: don't delay the response

## Related Code Files

**Modify:**
- `src/lib/supabase/middleware.ts` — add debounced last_active_at update

## Implementation Steps

1. After `supabase.auth.getUser()` succeeds (user is authenticated):
   - Extract user ID from `user.id`
   - Fire-and-forget: call service role client to update `user_sessions`
   - SQL: `UPDATE user_sessions SET last_active_at = now() WHERE user_id = $1 AND last_active_at < now() - interval '5 minutes'`
   - This naturally debounces: if `last_active_at` was updated <5min ago, UPDATE affects 0 rows

2. Important: use a separate service role client (not the user's anon client) since RLS UPDATE policy requires `auth.uid() = user_id`, but middleware runs server-side. Alternative: add RLS UPDATE policy so authenticated user can update their own sessions.

3. **Approach decision:** Use RLS UPDATE policy (simpler). The middleware already has the user's JWT, so `auth.uid()` works. Just call:
   ```typescript
   // Non-blocking, don't await
   supabase
     .from("user_sessions")
     .update({ last_active_at: new Date().toISOString() })
     .eq("user_id", user.id)
     .lt("last_active_at", fiveMinutesAgo)
     .then(() => {});
   ```

4. Since middleware cannot know which specific session row belongs to this browser, update ALL sessions for this user that are stale. This is acceptable — worst case all 3 sessions get bumped, which is fine since the user is active.

   **Better approach:** Match by a session identifier. Options:
   - Store session ID in a custom cookie on login → match in middleware
   - Use Supabase session's access token hash as identifier

   **Simplest:** Add a custom cookie `session_id` during login (set in login route response). Middleware reads this cookie to update the specific session row.

## Todo

- [ ] Set `session_id` cookie in login route response
- [ ] Read `session_id` cookie in middleware
- [ ] Fire-and-forget update with 5-min debounce
- [ ] Verify no performance impact

## Success Criteria

- `last_active_at` updates roughly every 5 minutes for active sessions
- No measurable latency added to requests
- Correct session row updated (not all sessions for user)

## Risk

- Cookie not set: gracefully skip update (no crash)
- Stale sessions with old `last_active_at`: acceptable, handled by cap enforcement ordering
