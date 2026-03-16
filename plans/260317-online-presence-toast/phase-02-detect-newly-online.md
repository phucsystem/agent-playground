---
phase: 2
priority: high
status: completed
effort: M
---

# Phase 2: Detect Newly-Online Users

## Overview

Modify `useSupabasePresence` to diff current vs previous online users and expose newly-arrived human users.

## Related Code Files

- **Modify:** `src/hooks/use-supabase-presence.ts`

## Implementation Steps

### 1. Add refs for tracking previous state and initial sync

```typescript
const previousIdsRef = useRef<Set<string>>(new Set());
const isInitialSyncRef = useRef(true);
const [newlyOnlineUsers, setNewlyOnlineUsers] = useState<OnlineUser[]>([]);
```

### 2. Inside the sync handler, after building `users` array

```typescript
// After: setOnlineUsers(users);

const currentIds = new Set(users.map((user) => user.user_id));

if (isInitialSyncRef.current) {
  // First sync — store state but don't notify
  isInitialSyncRef.current = false;
  previousIdsRef.current = currentIds;
  return;
}

// Diff: find users in current but not in previous
const newArrivals = users.filter(
  (user) =>
    !previousIdsRef.current.has(user.user_id) &&
    !user.is_agent &&
    user.user_id !== currentUser?.id
);

if (newArrivals.length > 0) {
  setNewlyOnlineUsers(newArrivals);
}

previousIdsRef.current = currentIds;
```

### 3. Update return value

```typescript
return { onlineUsers, newlyOnlineUsers, clearNewlyOnline: () => setNewlyOnlineUsers([]) };
```

### Key Details

- `isInitialSyncRef` prevents toast flood on first load
- `previousIdsRef` persists across renders without triggering re-render
- Filter out agents (`is_agent`) and self (`currentUser.id`)
- `clearNewlyOnline` lets consumer reset after showing toasts

## Edge Cases

- **Tab refocus:** Supabase may re-sync. The ref tracks real previous state so only genuinely new users trigger.
- **Rapid reconnect:** If user disconnects and reconnects within same sync interval, they appear as new. Acceptable for 3s toast.

## Todo

- [ ] Add previousIdsRef and isInitialSyncRef
- [ ] Add newlyOnlineUsers state
- [ ] Implement diff logic in sync handler
- [ ] Expose newlyOnlineUsers + clearNewlyOnline in return
- [ ] Verify no toast on initial load
