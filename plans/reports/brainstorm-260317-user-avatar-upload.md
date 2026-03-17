---
date: 2026-03-17
type: brainstorm
slug: user-avatar-upload
status: agreed
---

# Brainstorm: User Avatar Upload

## Problem
Users can't upload custom avatar images. Avatars are admin-set DiceBear SVGs only. No self-service profile editing exists.

## Agreed Constraints

| Decision | Choice |
|----------|--------|
| Who uploads | Users themselves (admins can still override) |
| DiceBear | Coexists — user chooses upload OR DiceBear |
| Storage | Supabase Storage, new `avatars` public bucket |
| UI entry point | Click profile avatar in sidebar |
| Image processing | Crop (circle) + resize before upload |

## Recommended Approach

### 1. Storage (Supabase)
- New **public** bucket `avatars` with RLS
- Path: `avatars/{userId}.webp` (single file per user, overwritten on change)
- Public bucket = no signed URLs needed, permanent URL with cache-busting `?t=` param
- RLS: users can only write their own `{userId}.*` path; anyone can read

### 2. Client-side Crop + Upload
- **Library:** `react-easy-crop` — 10-15KB gzip, React 19 compatible, native `cropShape="round"`, TS built-in
- Flow: pick file → crop circle → canvas export → resize 256x256 → WebP → upload
- Max input: 5MB before crop
- Output: always 256x256 WebP (~10-30KB)

### 3. UI: Profile Avatar Dialog
- Click UserProfile avatar in sidebar → dialog opens
- Two tabs: **Upload Photo** | **Generate Avatar** (DiceBear)
- Upload: file picker → crop preview → save
- Generate: current DiceBear style picker (moved from admin)
- Save updates `users.avatar_url` with Storage URL or DiceBear URL
- Admin edit-user-dialog gains upload option too

## Architecture

```
User clicks avatar → ProfileAvatarDialog opens
  ├── Tab 1: Upload
  │   ├── File input (accept image/*)
  │   ├── react-easy-crop (circle, aspect 1:1)
  │   ├── Canvas resize → 256x256 WebP blob
  │   ├── Upload to Supabase Storage: avatars/{userId}.webp
  │   └── Update users.avatar_url = public URL + ?t={timestamp}
  └── Tab 2: Generate (DiceBear)
      ├── Style grid (existing 12 styles)
      ├── Randomize seed
      └── Update users.avatar_url = DiceBear URL
```

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Public bucket | Avatars non-sensitive; avoids signed URL expiry headaches |
| Single file `{userId}.webp` | No orphan cleanup; overwrite = automatic |
| WebP output | ~70% smaller than PNG; all modern browsers support |
| Cache-busting `?t=` param | Forces reload after change |
| 256x256 max | More than enough for 32-48px display; tiny file |
| `react-easy-crop` | Only lib with React 19 compat + circle crop + active maintenance |

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/0XX_avatars_bucket.sql` | Create bucket + RLS |
| `src/components/profile/avatar-editor-dialog.tsx` | **New** — crop + DiceBear picker |
| `src/hooks/use-avatar-upload.ts` | **New** — upload + update user |
| `src/components/sidebar/user-profile.tsx` | Modify — make avatar clickable |
| `src/components/admin/edit-user-dialog.tsx` | Modify — add upload option |
| `next.config.ts` | Modify — add Storage domain to remotePatterns |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Large file uploads | Client-side 5MB limit; output always <50KB |
| Bucket creation via migration | Fallback to dashboard/seed script if needed |
| Library future compat | Actively maintained; pinned version |
| Cache staleness | `?t={timestamp}` cache-busting |

## Excluded (YAGNI)
- No moderation/approval workflow
- No workspace avatar upload (already has URL paste)
- No avatar history/versioning
- No server-side processing

## Next Steps
- Create implementation plan via `/plan`
