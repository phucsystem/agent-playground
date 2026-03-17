---
phase: 1
status: completed
priority: high
effort: small
---

# Phase 1: Storage & Migration

## Overview
Create Supabase Storage `avatars` bucket (public) with RLS policies scoped to per-user write access.

## Context Links
- Existing storage policies: `supabase/migrations/005_security_fixes.sql`
- Latest migration: `019_workspace_color.sql`
- Brainstorm: `plans/reports/brainstorm-260317-user-avatar-upload.md`

## Files to Create

### `supabase/migrations/020_avatar_storage.sql`

**Bucket creation:**
- Public bucket `avatars` (public = true, so `getPublicUrl` works without signed URLs)
- Note: Supabase migrations may not support `INSERT INTO storage.buckets` — if so, create bucket via dashboard/CLI and only include RLS policies in migration

**RLS policies on `storage.objects`:**

```sql
-- Users can upload/update their own avatar only
CREATE POLICY "avatars_upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can overwrite their own avatar
CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Anyone can read avatars (public bucket)
CREATE POLICY "avatars_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
```

**Storage path convention:** `{userId}/avatar.webp`
- Using folder per user (not flat `{userId}.webp`) to match Supabase `storage.foldername()` helper

## Implementation Steps

1. Create migration file `020_avatar_storage.sql`
2. Add bucket creation SQL (if supported) or document manual step
3. Add 3 RLS policies: INSERT, UPDATE, SELECT
4. Test: user can upload to their own folder, cannot write to others'

## Success Criteria
- [ ] `avatars` bucket exists (public)
- [ ] RLS: user can only write `{their-id}/avatar.webp`
- [ ] RLS: anyone can read any avatar
- [ ] Migration file numbered correctly after 019

## Risk
- `INSERT INTO storage.buckets` may not work in migration — fallback: create bucket manually via Supabase dashboard, only RLS policies in migration
