# Phase 1: Database Migration + Types

**Priority:** High
**Status:** pending
**Effort:** Small

## Context

- Brainstorm: `plans/reports/brainstorm-260317-multi-session-support.md`
- DB Design: `docs/DB_DESIGN.md`
- Existing migrations: `001` through `012`

## Overview

Create `user_sessions` table to track active sessions per user. Add TypeScript interface. Next migration is `013`.

## Requirements

- Track session per device: user_id, device_name, user_agent, supabase_session_id
- `last_active_at` for debounced activity tracking
- RLS: users can only see/delete their own sessions; service role inserts

## Architecture

```
user_sessions
├── id (uuid PK)
├── user_id (uuid FK → users.id ON DELETE CASCADE)
├── supabase_session_id (text) — links to Supabase Auth session
├── device_name (text NOT NULL) — "Chrome on macOS"
├── user_agent (text) — raw UA string
├── last_active_at (timestamptz NOT NULL DEFAULT now())
└── created_at (timestamptz NOT NULL DEFAULT now())
```

## Related Code Files

**Create:**
- `supabase/migrations/013_user_sessions.sql`

**Modify:**
- `src/types/database.ts` — add `UserSession` interface + update `Database` type

## Implementation Steps

1. Create migration `013_user_sessions.sql`:
   - CREATE TABLE `user_sessions` with columns above
   - CREATE INDEX `idx_user_sessions_user_id` on `user_id`
   - CREATE INDEX `idx_user_sessions_last_active` on `(user_id, last_active_at ASC)` (for finding oldest)
   - Enable RLS
   - RLS SELECT: `auth.uid() = user_id`
   - RLS DELETE: `auth.uid() = user_id` (user can revoke own sessions)
   - RLS UPDATE: `auth.uid() = user_id` (for last_active_at updates)
   - No INSERT policy for regular users (service role inserts via login route)

2. Update `src/types/database.ts`:
   - Add `UserSession` interface
   - Add to `Database.public.Tables`

## Todo

- [ ] Create migration file
- [ ] Add TypeScript interface
- [ ] Run `supabase db push` to verify migration

## Success Criteria

- Migration applies without errors
- Table created with correct indexes and RLS
- TypeScript types compile
