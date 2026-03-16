# Phase 4: UI Toggle

**Priority:** High
**Status:** completed
**Depends on:** Phase 1 (DB column exists)

## Overview

Add notification toggle switch to the user profile section in the sidebar.

## Related Code

- `src/components/sidebar/user-profile.tsx` — current user profile component (37 lines)
- `src/components/sidebar/sidebar.tsx` — parent that renders UserProfile

## Files to Modify

| File | Action |
|------|--------|
| `src/components/sidebar/user-profile.tsx` | Modify — add toggle + update handler |

## Implementation Steps

### 1. Update `user-profile.tsx`

Add a bell icon toggle between the user info and logout button.

```tsx
// New props needed:
interface UserProfileProps {
  currentUser: User;
  onLogout: () => void;
  onToggleNotification: (enabled: boolean) => void; // NEW
}
```

**UI Layout:**

```
┌──────────────────────────────────────┐
│ [Avatar] Display Name                │
│          ● Online     [🔔] [↩ logout]│
└──────────────────────────────────────┘
```

- Bell icon: `Bell` or `BellOff` from lucide-react
- Toggle behavior: click bell → toggles `notification_enabled`
- Visual state: filled/colored when ON, muted/gray when OFF
- On first enable: call `requestPermission()` for native notifications

### 2. Update handler

The toggle calls Supabase to update the user's `notification_enabled` column:

```typescript
const toggleNotification = async (enabled: boolean) => {
  const supabase = createBrowserSupabaseClient();
  await supabase
    .from("users")
    .update({ notification_enabled: enabled })
    .eq("id", currentUser.id);
};
```

### 3. Wire through sidebar.tsx

Pass `onToggleNotification` prop from sidebar (or handle directly in user-profile).

**Decision:** Handle the Supabase call directly in `user-profile.tsx` to avoid prop drilling. The component already has `currentUser` with the user ID.

### 4. Request notification permission on first enable

When user turns ON notifications for the first time:
```typescript
if (enabled && Notification.permission === "default") {
  await Notification.requestPermission();
}
```

## Design Tokens

- Bell ON: `text-primary-500` (blue)
- Bell OFF: `text-neutral-400` (gray)
- Hover: `hover:bg-neutral-200`
- Same button style as existing logout button

## Todo

- [ ] Add Bell/BellOff icon toggle to user-profile.tsx
- [ ] Add Supabase update call for notification_enabled
- [ ] Request notification permission on first enable
- [ ] Optimistic UI update (toggle immediately, revert on error)
- [ ] Verify toggle persists across page reload

## Success Criteria

- [ ] Bell icon visible in user profile section
- [ ] Click toggles notification_enabled in DB
- [ ] Visual state reflects current setting
- [ ] Permission prompt appears on first enable
- [ ] Preference persists across page reload / devices
