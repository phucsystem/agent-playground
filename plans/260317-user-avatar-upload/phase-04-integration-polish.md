---
phase: 4
status: completed
priority: medium
effort: small
---

# Phase 4: Integration & Polish

## Overview
Wire everything together, update Next.js config, add upload option to admin edit-user-dialog, verify all avatar displays update correctly.

## Dependencies
- Phase 3: dialog and hook complete

## Files to Modify

### `next.config.ts`
Already has `*.supabase.co` pattern for storage — verify it covers public bucket URLs.
Current pattern: `pathname: "/storage/v1/object/**"` — this covers both signed and public URLs. **No change needed** if using `<img>` tags (not `<Image>`). If using Next.js `<Image>`, ensure pattern matches.

Check: avatars are displayed via `<img>` tags in avatar.tsx — **no Next.js Image optimization used**. No config change needed.

### `src/components/admin/edit-user-dialog.tsx` (MODIFY)
Add upload option alongside DiceBear:
1. Add a file input + mini crop area (same as profile dialog but compact)
2. OR simpler: add "Upload Image" button that opens a file picker, uploads directly (no crop in admin — admin use case is less frequent)
3. **Recommended: keep admin dialog simple** — just add a URL field where admin can paste any URL (including Supabase Storage public URLs). The self-service crop dialog is for users.

Actually, admin already has DiceBear which is sufficient for admin use. **Skip adding upload to admin dialog** — users now have their own upload flow. Admin can still set DiceBear avatars.

### `src/components/ui/avatar.tsx` (VERIFY)
Verify the Avatar component handles both:
- DiceBear SVG URLs (`https://api.dicebear.com/...`)
- Supabase Storage URLs (`https://{project}.supabase.co/storage/v1/object/public/avatars/...`)

Current implementation uses `<img src={avatarUrl}>` — works with any URL. **No change needed.**

### `src/app/setup/page.tsx` (OPTIONAL)
Could add upload option to first-time setup. **Skip for now** — DiceBear is fine for onboarding. Users can upload later from sidebar.

## Implementation Steps

1. Verify `next.config.ts` covers Supabase public URLs (likely no change)
2. Verify `avatar.tsx` renders any URL correctly (no change)
3. Test full flow: sidebar click → upload → crop → save → avatar updates everywhere
4. Test: generate DiceBear → save → avatar updates
5. Test: upload replaces DiceBear, DiceBear replaces upload
6. Verify mobile responsive: dialog usable on small screens

## Success Criteria
- [ ] Avatar upload works end-to-end
- [ ] Avatar displays correctly in: sidebar profile, message list, online users, chat header
- [ ] Cache-busting `?t=` param ensures immediate update
- [ ] Mobile: dialog is usable (crop area responsive)
- [ ] No console errors or type errors

## Notes
- No changes to admin edit-user-dialog (users have self-service now)
- No changes to setup page (DiceBear for onboarding is fine)
- No changes to next.config.ts (existing pattern covers public URLs)
- This phase is primarily verification and testing
