# Code Review: User Avatar Upload Feature

**Date:** 2026-03-17
**Reviewer:** code-reviewer
**Scope:** 8 files, ~500 LOC
**Focus:** Security, error handling, React patterns, edge cases

---

## Overall Assessment

Solid feature implementation with clean component composition and good separation of concerns. The upload hook, crop utility, and editor dialog are well-structured. However, there are several security gaps in the storage migration, a missing DELETE policy, a memory leak in the crop utility, and an XSS surface via DiceBear URLs stored directly in the database.

---

## Critical Issues

### C1. No DELETE policy on avatar storage objects

**File:** `supabase/migrations/020_avatar_storage.sql`

No DELETE policy exists. If a user wants to remove their avatar or if cleanup is needed, there is no way to delete old objects via the client. Orphaned blobs will accumulate indefinitely.

**Fix:**
```sql
CREATE POLICY "avatars_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

### C2. No server-side file size or MIME type restriction

**File:** `supabase/migrations/020_avatar_storage.sql`

The 5MB limit and image type check only exist client-side (`avatar-editor-dialog.tsx` line 64-71). A crafted API request can bypass these and upload arbitrarily large files or non-image content (e.g., HTML files that execute JS when opened from the public bucket URL).

**Fix:** Add bucket-level constraints:
```sql
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/gif']
WHERE id = 'avatars';
```

### C3. Unauthenticated users can read all avatar objects

**File:** `supabase/migrations/020_avatar_storage.sql` (line 25-26)

The `avatars_read` policy has no `auth.uid() IS NOT NULL` check. Combined with `public = true` on the bucket, anyone (even unauthenticated) can enumerate and download all avatar files. Since the bucket is public (direct URL access), this is by design for avatar display, but the SELECT policy should still require authentication for listing operations.

**Severity:** Medium-High (depends on whether avatar URLs are considered sensitive; public bucket already exposes files via direct URL, so the SELECT policy gap is incremental).

### C4. XSS via DiceBear avatar URL stored in database

**File:** `avatar-editor-dialog.tsx` (line 103-106), `avatar.tsx` (line 67)

The `handleSaveGenerate` function stores a DiceBear URL directly in `avatar_url`. This URL is later rendered as `<img src={avatarUrl}>`. If the DiceBear API were compromised or if the URL construction were manipulated, SVG content could contain embedded scripts. The `Avatar` component renders `src` without sanitization.

Current risk is low because `encodeURIComponent` is used for the seed and the style is from a fixed array. However, there is no allowlist validation when reading `avatar_url` back from the database.

**Recommendation:** Consider proxying external avatar URLs through your own storage or validate avatar URLs against an allowlist pattern (`^https://api\.dicebear\.com/` or Supabase storage URL) before rendering.

---

## High Priority

### H1. Memory leak in crop-image.ts -- FileReader data URL never revoked

**File:** `src/lib/crop-image.ts` (line 8-16), `avatar-editor-dialog.tsx` (line 76)

`createImage()` loads a data URL into an `HTMLImageElement`. The data URL from `FileReader.readAsDataURL` is held in memory as the `imageSrc` state. When the user picks a new image or closes the dialog, the old data URL string persists until garbage collection. For large images (~5MB), this can spike memory.

Not a traditional `URL.revokeObjectURL` leak (since it uses `readAsDataURL` not `createObjectURL`), but switching to `URL.createObjectURL` + cleanup pattern would be more memory-efficient for large files.

**Recommendation:** Use `URL.createObjectURL(file)` instead of `FileReader.readAsDataURL`, and call `URL.revokeObjectURL` in a cleanup effect or when switching images.

### H2. Cache-busting timestamp stored permanently in avatar_url

**File:** `src/hooks/use-avatar-upload.ts` (line 32)

```ts
const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
```

The cache-busting `?t=` parameter is persisted to the `users` table. Every upload stores a different timestamp. This means:
- The database accumulates unique URLs for the same logical avatar
- CDN/browser caching is defeated permanently (each page load uses the stored timestamp, not a fresh one)
- Comparison-based caching (`if oldUrl !== newUrl`) always triggers re-renders

**Fix:** Store the clean URL in the database. Apply cache-busting at render time:
```ts
// In upload hook - store clean URL
return urlData.publicUrl;

// In Avatar component - bust cache at render
src={`${avatarUrl}?v=${Date.now()}`}
```

### H3. No `users_public` view update to include `notification_enabled` after migration 015

**File:** `supabase/migrations/015_notification_preferences.sql`

The `users_public` view was updated in migration 015 to include `notification_enabled`. However, `useCurrentUser` fetches from `users_public`. Confirm `avatar_url` is included in the view -- it is (from migration 005). No action needed for avatar specifically, but noting for completeness.

---

## Medium Priority

### M1. Dialog does not trap focus or handle Escape key

**File:** `avatar-editor-dialog.tsx` (line 120-272)

The dialog uses a custom overlay `div` with `onClick={onClose}` but lacks:
- Keyboard `Escape` to close
- Focus trapping (tab can reach elements behind the overlay)
- `role="dialog"` and `aria-modal="true"` attributes

**Recommendation:** Add `onKeyDown` handler for Escape and consider using Radix Dialog or headless UI for accessibility.

### M2. Double save protection is incomplete

**File:** `avatar-editor-dialog.tsx` (lines 80-95, 97-116)

`isBusy` disables the save button, but `handleSaveUpload` and `handleSaveGenerate` do not check `isBusy` at entry. Rapid double-clicks before React re-renders could trigger duplicate uploads.

**Fix:** Guard at function entry:
```ts
async function handleSaveUpload() {
  if (isBusy || !imageSrc || !croppedAreaPixels) return;
  // ...
}
```

### M3. Notification toggle has optimistic update without proper error toast

**File:** `user-profile.tsx` (lines 27-49)

`handleToggleNotification` rolls back `notificationEnabled` on error but does not inform the user. A silent rollback is confusing.

**Fix:** Add a toast or set an error state on failure.

### M4. `useCurrentUser` does not handle auth state changes

**File:** `src/hooks/use-current-user.ts`

`fetchUser` runs once on mount. If the user's session expires or they sign out in another tab, `currentUser` becomes stale. No `onAuthStateChange` subscription.

**Recommendation:** Subscribe to `supabase.auth.onAuthStateChange` and re-fetch on `SIGNED_IN`/`SIGNED_OUT` events.

---

## Low Priority

### L1. `createBrowserSupabaseClient()` called in multiple places per render cycle

**Files:** `use-avatar-upload.ts`, `avatar-editor-dialog.tsx`, `user-profile.tsx`

Each function call creates a new client instance. If `createBrowserSupabaseClient` is not memoized internally (most Supabase helpers are), this could cause multiple GoTrue instances.

**Verify:** Confirm `createBrowserSupabaseClient` uses a singleton pattern.

### L2. Hardcoded styles array could drift from DiceBear API

**File:** `avatar-editor-dialog.tsx` (lines 12-16)

If DiceBear deprecates a style, the preview will show broken images with no fallback or error handling on `<img>` load failure.

**Recommendation:** Add `onError` handler to fallback avatars.

---

## Edge Cases Found by Scout

1. **Race condition on rapid tab switching:** User opens upload tab, selects image, switches to generate tab, switches back -- `croppedAreaPixels` may be stale if the cropper re-initializes.

2. **User uploads avatar then immediately opens dialog again:** The old `avatar_url` with timestamp is still in `currentUser` state until `refreshUser` completes. Could briefly show stale avatar.

3. **Concurrent uploads from multiple tabs:** Two browser tabs could race on `upsert: true` upload. Both succeed but the `users.avatar_url` update from the slower tab overwrites the faster one. The stored URL timestamp differs from the actual latest file.

4. **DiceBear API downtime:** All generated avatar previews fail silently. The grid shows 17 broken images with no loading/error states.

5. **File input `accept` attribute mismatch with validation:** `accept="image/jpeg,image/png,image/gif,image/webp"` matches the client check, but without server-side MIME validation (see C2), renamed files bypass both.

---

## Positive Observations

- Clean separation: crop utility, upload hook, and editor dialog are well-factored
- Proper use of `useCallback`/`useMemo` to prevent unnecessary re-renders
- Cache-busting strategy for avatars (even if placement needs adjustment per H2)
- RLS policies correctly scope writes to `auth.uid()::text` folder
- Good UX: two-tab approach (upload vs generate) with live preview
- Proper error boundary in upload hook with try/catch/finally
- `upsert: true` handles re-uploads cleanly without needing delete-then-insert

---

## Recommended Actions (Priority Order)

1. **[Critical]** Add server-side file size + MIME type constraints to `avatars` bucket (C2)
2. **[Critical]** Add DELETE storage policy (C1)
3. **[High]** Move cache-busting from database to render time (H2)
4. **[High]** Switch from `readAsDataURL` to `createObjectURL` pattern (H1)
5. **[Medium]** Add Escape key handler and basic a11y to dialog (M1)
6. **[Medium]** Add double-click guard to save handlers (M2)
7. **[Medium]** Add error feedback on notification toggle failure (M3)
8. **[Low]** Add `onError` fallback to DiceBear preview images (L2)

---

## Metrics

- Type Coverage: Good -- all props interfaces defined, Area type from react-easy-crop used
- Test Coverage: Unknown (no tests in scope)
- Linting Issues: Not evaluated per instructions

---

## Unresolved Questions

1. Is `createBrowserSupabaseClient()` a singleton? If not, multiple instances per render cycle (L1) becomes Medium priority.
2. Should unauthenticated read access to avatars (C3) be restricted, or is public bucket behavior acceptable for this use case?
3. Is there a plan for avatar cleanup (deleting old storage objects when users switch to DiceBear)?
