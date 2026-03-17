---
phase: 2
status: completed
priority: high
effort: medium
---

# Phase 2: Avatar Upload Hook

## Overview
Install `react-easy-crop`, create `useAvatarUpload` hook for crop → resize → WebP → upload → update user flow.

## Context Links
- Existing upload pattern: `src/hooks/use-file-upload.ts`
- User update pattern: `src/components/admin/edit-user-dialog.tsx` (lines 70-93)
- Supabase client: `src/lib/supabase/client.ts`

## Dependencies
- Phase 1: `avatars` bucket must exist

## Files to Create/Modify

### Install dependency
```bash
pnpm add react-easy-crop
```

### `src/lib/crop-image.ts` (NEW)
Canvas-based utility to crop + resize + convert to WebP.

**Exports:**
```typescript
export async function getCroppedImage(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  outputSize?: number  // default 256
): Promise<Blob>
```

**Logic:**
1. Create offscreen canvas at `outputSize x outputSize`
2. Draw source image cropped to `pixelCrop` region
3. Export as WebP blob (`canvas.toBlob('image/webp', 0.85)`)
4. Return blob

### `src/hooks/use-avatar-upload.ts` (NEW)

**Exports:**
```typescript
export function useAvatarUpload() {
  // State
  uploading: boolean
  error: string | null

  // Methods
  uploadAvatar(blob: Blob, userId: string): Promise<string>  // returns public URL
}
```

**`uploadAvatar` logic:**
1. Upload blob to Supabase Storage: `avatars/{userId}/avatar.webp` (upsert: true)
2. Get public URL via `supabase.storage.from('avatars').getPublicUrl(path)`
3. Append `?t={Date.now()}` for cache-busting
4. Update `users.avatar_url` with the public URL
5. Return the URL

**Key details:**
- `upsert: true` — overwrite previous avatar
- `contentType: 'image/webp'` — explicit content type
- `cacheControl: '31536000'` — 1 year (cache-busted by `?t=` param)
- Error handling: set error state, throw for caller to handle

## Implementation Steps

1. `pnpm add react-easy-crop`
2. Create `src/lib/crop-image.ts` — canvas crop utility
3. Create `src/hooks/use-avatar-upload.ts` — upload + update user
4. Verify TypeScript compiles

## Success Criteria
- [ ] `react-easy-crop` installed
- [ ] `getCroppedImage()` produces 256x256 WebP blob
- [ ] `uploadAvatar()` uploads to correct path, updates user record
- [ ] Public URL returned with cache-busting param
- [ ] Hook exposes `uploading` and `error` states

## Notes
- `getCroppedImage` is a pure utility (no React), keep in `lib/`
- Hook follows existing pattern from `use-file-upload.ts`
- WebP quality 0.85 balances size (~15-25KB) vs visual quality
