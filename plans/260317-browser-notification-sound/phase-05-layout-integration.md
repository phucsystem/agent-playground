# Phase 5: Layout Integration

**Priority:** High
**Status:** completed
**Depends on:** Phase 2, Phase 3, Phase 4

## Overview

Mount `useNotificationSound` hook in `ChatLayoutInner` and wire everything together.

## Files to Modify

| File | Action |
|------|--------|
| `src/app/chat/layout.tsx` | Modify — add hook call |

## Implementation Steps

### 1. Import and mount the hook

In `ChatLayoutInner`:

```typescript
import { useNotificationSound } from "@/hooks/use-notification-sound";

// Inside ChatLayoutInner:
const { requestPermission } = useNotificationSound(currentUser, conversations);
```

The hook handles everything internally:
- Global realtime subscription lifecycle
- Sound playback
- Native notification display
- Debounce + multi-tab coordination

### 2. Pass requestPermission to UserProfile (via Sidebar)

The `requestPermission` function needs to reach `user-profile.tsx` so it can be called when the user first enables notifications.

**Option A:** Pass as prop through Sidebar → UserProfile
**Option B:** Call requestPermission inside the hook when notification_enabled changes to true

**Decision:** Option B — the hook can detect when `currentUser.notification_enabled` transitions to `true` and auto-request permission. No prop drilling needed.

### 3. Final layout.tsx changes

Minimal — just one line to mount the hook:

```diff
+ import { useNotificationSound } from "@/hooks/use-notification-sound";

function ChatLayoutInner({ children }: { children: React.ReactNode }) {
  // ... existing hooks ...
+ useNotificationSound(currentUser, conversations);
  // ... rest of component ...
}
```

## Todo

- [ ] Import and mount `useNotificationSound` in layout.tsx
- [ ] Verify no duplicate realtime subscriptions
- [ ] Test end-to-end: toggle ON → receive DM while unfocused → sound + notification
- [ ] Test: toggle OFF → no sound/notification
- [ ] Test: multiple tabs → only one sound

## Success Criteria

- [ ] Hook mounted in chat layout
- [ ] No regressions in existing toast/presence/health features
- [ ] Full flow works: DM → unfocused → sound + notification
- [ ] Full flow works: @mention → unfocused → sound + notification
- [ ] Toggle OFF disables everything
