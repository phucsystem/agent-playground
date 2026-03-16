# Brainstorm: Multi-Device Session Support

**Date:** 2026-03-17
**Status:** Agreed
**Participants:** User + Claude

---

## Problem Statement

Currently single JWT session per user. Logging in from new device silently replaces old session. Users need simultaneous access from phone, laptop, tablet (up to 3 devices) with basic tracking.

## Requirements

- Same user logged in on up to 3 devices simultaneously
- Basic session tracking: device name + last active timestamp
- When 4th login: auto-kick oldest session + toast notification
- No full audit trail needed (no IP, no location)

## Evaluated Approaches

### Option A: Custom `user_sessions` Table (SELECTED)

| Aspect | Detail |
|--------|--------|
| Concept | Track sessions in custom table, enforce cap server-side |
| Pros | Full control, easy UI integration, works with existing Supabase Auth |
| Cons | Must keep in sync with Supabase Auth (low risk — controlled login/logout flows) |

### Option B: Supabase Auth Sessions Only

| Aspect | Detail |
|--------|--------|
| Concept | Use `auth.sessions` table directly |
| Pros | Zero custom tables, always in sync |
| Cons | No RLS access, limited metadata, harder cap enforcement, Admin API required for listing |

### Option C: Hybrid (Custom + Supabase Sync)

| Aspect | Detail |
|--------|--------|
| Concept | Custom table as read model, Supabase Auth as source of truth, synced via triggers |
| Pros | Best consistency guarantees |
| Cons | Most complex, webhook/trigger overhead |

## Final Solution: Option A

### Database Schema

```sql
CREATE TABLE user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supabase_session_id text,
  device_name text NOT NULL,        -- "Chrome on macOS"
  user_agent text,                  -- raw string
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
```

### Login Flow (`/api/auth/login`)

1. Validate token → get user
2. Query `user_sessions` count for user
3. If count >= 3: find oldest by `last_active_at`, revoke via Supabase Admin API, DELETE row, store kicked device info
4. Sign in via Supabase Auth → new session
5. INSERT `user_sessions` with device_name (parsed from user-agent)
6. Return response with optional `kicked_session` payload

### Cap Enforcement

- Auto-kick oldest (least recently active) session
- Revoke Supabase Auth session via `auth.admin.signOut(session_id)`
- Client shows toast: "Logged out from {device_name} (inactive since {time})"
- Uses existing sonner toast system

### Middleware: `last_active_at` Updates

- Debounced: only update if `last_active_at > 5 minutes ago`
- ~12 writes/user/hour max
- No performance concern

### Logout

- `signOut`: DELETE from `user_sessions` WHERE matching current session
- Future "revoke all": DELETE all + admin.signOut for each

### Presence

- No changes needed — each device gets own presence entry via Supabase Realtime

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Session table out of sync | Periodic cleanup: delete rows where Supabase session expired |
| User-agent parsing | `ua-parser-js` (~7KB) — reliable for device name extraction |
| DB write pressure | 5-min debounce keeps writes minimal |
| Supabase Admin API limits | Only called during cap enforcement (rare) |

## Files to Modify

- `supabase/migrations/` — new migration for `user_sessions` table
- `src/app/api/auth/login/route.ts` — session tracking + cap enforcement
- `src/lib/supabase/middleware.ts` — debounced `last_active_at` update
- `src/lib/auth.ts` — logout cleanup
- `src/app/login/page.tsx` — handle kicked_session toast
- New utility: user-agent parser (or add `ua-parser-js` dependency)

## Success Criteria

- User can login from 3 devices simultaneously
- 4th login kicks oldest with toast notification
- Sessions table reflects actual active sessions
- Logout cleans up session record
- No regression in existing auth flow

## Next Steps

- Create implementation plan if approved
- Consider future UI: "Active Sessions" panel in user settings (out of scope for now)
