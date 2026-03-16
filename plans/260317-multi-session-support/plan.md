# Multi-Device Session Support

**Created:** 2026-03-17
**Status:** pending
**Brainstorm:** `plans/reports/brainstorm-260317-multi-session-support.md`

## Summary

Add multi-device login support (max 3 concurrent sessions) with basic device tracking. When a 4th session is created, the oldest is auto-kicked with a toast notification.

## Phases

| # | Phase | Status | Priority | Effort |
|---|-------|--------|----------|--------|
| 1 | Database migration + types | pending | high | small |
| 2 | Login route: session tracking + cap enforcement | pending | high | medium |
| 3 | Middleware: debounced last_active_at | pending | medium | small |
| 4 | Client: logout cleanup + kicked-session toast | pending | medium | small |

## Key Decisions

- Custom `user_sessions` table (Option A from brainstorm)
- `ua-parser-js` for device name extraction
- 5-minute debounce on `last_active_at` updates
- Auto-kick oldest session when cap exceeded
- Sonner toast for kicked session notification

## Dependencies

- Supabase Admin API for revoking sessions (`auth.admin.signOut`)
- `ua-parser-js` npm package (~7KB)

## Files Affected

| File | Change |
|------|--------|
| `supabase/migrations/013_user_sessions.sql` | NEW — create table + RLS |
| `src/types/database.ts` | ADD UserSession interface |
| `src/app/api/auth/login/route.ts` | MODIFY — session tracking + cap |
| `src/lib/supabase/middleware.ts` | MODIFY — debounced last_active_at |
| `src/lib/auth.ts` | MODIFY — logout cleanup |
| `src/app/login/page.tsx` | MODIFY — handle kicked_session toast |
| `src/lib/session-utils.ts` | NEW — user-agent parser + session helpers |
| `package.json` | ADD ua-parser-js |
