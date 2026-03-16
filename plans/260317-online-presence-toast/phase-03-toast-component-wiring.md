---
phase: 3
priority: high
status: completed
effort: S
---

# Phase 3: Presence Toast Component + Wiring

## Overview

Create custom toast content component and wire it up in layout.tsx to fire on newly-online users.

## Related Code Files

- **Create:** `src/components/ui/presence-toast.tsx`
- **Modify:** `src/app/chat/layout.tsx`

## Implementation Steps

### 1. Create `presence-toast.tsx`

```typescript
// src/components/ui/presence-toast.tsx
import { Avatar } from "./avatar";

interface PresenceToastProps {
  displayName: string;
  avatarUrl: string | null;
}

export function PresenceToast({ displayName, avatarUrl }: PresenceToastProps) {
  return (
    <div className="flex items-center gap-3">
      <Avatar displayName={displayName} avatarUrl={avatarUrl} size="sm" />
      <div className="flex flex-col">
        <span className="text-sm font-medium text-neutral-800">
          {displayName}
        </span>
        <span className="text-xs text-neutral-500">is now online</span>
      </div>
    </div>
  );
}
```

### 2. Wire up in layout.tsx

```typescript
import { useEffect } from "react";
import { toast } from "sonner";
import { Toaster } from "sonner";
import { PresenceToast } from "@/components/ui/presence-toast";

// In ChatLayout component body:
const { onlineUsers, newlyOnlineUsers, clearNewlyOnline } = useSupabasePresence(currentUser);

useEffect(() => {
  if (newlyOnlineUsers.length === 0) return;

  for (const user of newlyOnlineUsers) {
    toast.custom(() => (
      <PresenceToast
        displayName={user.display_name}
        avatarUrl={user.avatar_url}
      />
    ));
  }

  clearNewlyOnline();
}, [newlyOnlineUsers, clearNewlyOnline]);
```

### 3. Add `<Toaster />` in JSX (from Phase 1)

Place after CreateGroupDialog, before closing fragment.

## Toast Styling

- sonner default card with white bg, subtle shadow
- Custom content via `toast.custom()` — Avatar + name + "is now online"
- Green left border optional via toastOptions className
- Position: top-right
- Duration: 3000ms
- Max 3 visible

## Todo

- [ ] Create `src/components/ui/presence-toast.tsx`
- [ ] Add useEffect in layout.tsx to fire toasts
- [ ] Add Toaster component in layout JSX
- [ ] Test: verify toast appears when another user comes online
- [ ] Test: verify no toast on page load
- [ ] Test: verify no toast for agents
