# Phase 1: DB Migration

**Priority:** High
**Status:** completed

## Overview

Add `notification_enabled` boolean column to `users` table. Update `users_public` view to expose it.

## Files to Modify

| File | Action |
|------|--------|
| `supabase/migrations/015_notification_preferences.sql` | Create |
| `src/types/database.ts` | Modify — add field to `User` interface |

## Implementation Steps

### 1. Create migration `015_notification_preferences.sql`

```sql
-- Add notification preference to users table
ALTER TABLE users ADD COLUMN notification_enabled boolean NOT NULL DEFAULT true;

-- Update users_public view to include new column
CREATE OR REPLACE VIEW users_public AS
  SELECT id, email, display_name, avatar_url, role, is_agent, is_active, is_mock, last_seen_at, created_at, notification_enabled
  FROM users;

GRANT SELECT ON users_public TO authenticated;
```

**Key notes:**
- Default `true` — opt-out model (standard for chat apps)
- Must recreate `users_public` view (defined in `005_security_fixes.sql`) to include new column
- Re-grant SELECT since `CREATE OR REPLACE VIEW` may reset permissions

### 2. Update `src/types/database.ts`

Add `notification_enabled: boolean` to the `User` interface (after `is_mock`).

Update `Database.public.Tables.users` types accordingly.

## Todo

- [ ] Create migration file
- [ ] Update User TypeScript interface
- [ ] Run migration locally: `supabase db push` or `supabase migration up`
- [ ] Verify column exists in DB

## Success Criteria

- [ ] `notification_enabled` column exists on `users` table with default `true`
- [ ] `users_public` view includes `notification_enabled`
- [ ] TypeScript `User` type has `notification_enabled: boolean`
