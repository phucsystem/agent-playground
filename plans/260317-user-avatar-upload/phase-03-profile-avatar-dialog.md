---
phase: 3
status: completed
priority: high
effort: medium
---

# Phase 3: Profile Avatar Dialog UI

## Overview
Create avatar editor dialog with two modes: Upload (crop) and Generate (DiceBear). Triggered by clicking profile avatar in sidebar.

## Context Links
- UserProfile component: `src/components/sidebar/user-profile.tsx`
- DiceBear picker pattern: `src/components/admin/edit-user-dialog.tsx`
- Dialog pattern: `src/components/admin/workspace-settings.tsx`
- Avatar component: `src/components/ui/avatar.tsx`

## Dependencies
- Phase 2: `useAvatarUpload` hook and `getCroppedImage` utility

## Files to Create/Modify

### `src/components/profile/avatar-editor-dialog.tsx` (NEW, ~150 LOC)

**Props:**
```typescript
interface AvatarEditorDialogProps {
  user: User;
  onClose: () => void;
  onSaved: () => void;
}
```

**UI Structure:**
```
┌─────────────────────────────────┐
│ Edit Avatar                  [X]│
│                                 │
│ [Upload Photo] [Generate]  tabs │
│                                 │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │   react-easy-crop area      │ │  ← Upload tab
│ │   (circle, aspect 1:1)     │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│ [Choose File]                   │
│                                 │
│        [Save]  [Cancel]         │
└─────────────────────────────────┘
```

**Upload tab flow:**
1. Hidden file input (`accept="image/jpeg,image/png,image/gif,image/webp"`, max 5MB)
2. On file select → create object URL → show in `react-easy-crop` (`cropShape="round"`, `aspect={1}`)
3. User drags/zooms to frame face
4. "Save" → `getCroppedImage(src, croppedAreaPixels)` → `uploadAvatar(blob, user.id)` → `onSaved()`

**Generate tab:**
- Extract DiceBear picker from `edit-user-dialog.tsx` (AVATAR_STYLES, seed, randomize)
- Reuse same grid layout (6 cols)
- "Save" → update `users.avatar_url` with DiceBear URL → `onSaved()`

**State:**
- `activeTab: 'upload' | 'generate'`
- `imageSrc: string | null` — object URL of selected file
- `crop: { x, y }` — crop position
- `zoom: number` — zoom level (1-3)
- `croppedAreaPixels` — from `onCropComplete` callback
- `selectedStyle, seed` — DiceBear state (reuse from edit-user-dialog)

**Key UX details:**
- Tab switch resets the other tab's state
- Zoom slider below crop area (min 1, max 3, step 0.1)
- Show current avatar as "Current" indicator
- Disable Save while uploading (show spinner)
- File size validation: reject >5MB with inline error

### `src/components/sidebar/user-profile.tsx` (MODIFY)

**Changes:**
1. Add `useState` for `showAvatarEditor`
2. Wrap Avatar in a clickable button with hover overlay (camera icon or subtle ring)
3. Render `<AvatarEditorDialog>` when `showAvatarEditor === true`
4. On `onSaved`: need to refresh `currentUser` — emit event or use callback from parent

**Avatar click target:**
```tsx
<button
  onClick={() => setShowAvatarEditor(true)}
  className="relative group cursor-pointer"
  title="Change avatar"
>
  <Avatar displayName={...} avatarUrl={...} />
  <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
    <Camera className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition" />
  </div>
</button>
```

### `src/hooks/use-current-user.ts` (MODIFY)

**Changes:**
- Add `refreshUser()` function that re-fetches from `users_public`
- Return `{ currentUser, loading, refreshUser }`
- `avatar-editor-dialog` calls `refreshUser` after save to update all UI

## Implementation Steps

1. Create `avatar-editor-dialog.tsx` with tab structure
2. Implement Upload tab: file input → crop → save
3. Implement Generate tab: extract DiceBear picker from edit-user-dialog
4. Modify `user-profile.tsx`: make avatar clickable, show dialog
5. Add `refreshUser` to `use-current-user.ts`
6. Wire `onSaved` → `refreshUser` through component chain
7. Verify TypeScript compiles

## Todo List
- [ ] Create avatar-editor-dialog component
- [ ] Upload tab with react-easy-crop
- [ ] Generate tab with DiceBear styles
- [ ] Make sidebar avatar clickable
- [ ] Add refreshUser to use-current-user hook
- [ ] Wire refresh through to chat layout

## Success Criteria
- [ ] Click avatar in sidebar → dialog opens
- [ ] Upload tab: select image → crop circle → save → avatar updates
- [ ] Generate tab: pick style → randomize → save → avatar updates
- [ ] All avatar instances across app update after save (via refreshUser)
- [ ] Dialog closes after successful save
- [ ] Error states shown for oversized files / upload failures

## Security
- File type validation on client (accept attribute + JS check)
- 5MB input limit before crop
- Output always 256x256 WebP (server can't receive unexpected formats)
- RLS on storage prevents writing to other users' folders
