# Phase 01 — Immediate Refetch After Group Creation

## Status: pending
## Priority: CRITICAL — this is the primary bug fix

## Problem
`CreateGroupDialog` does not notify the sidebar after creating a group.
It calls `onClose()` + `router.push()` and depends entirely on Supabase realtime (100ms–2s latency) to update the sidebar.

## Root Cause
In `layout.tsx:32`:
```ts
const { conversations } = useConversations(activeWorkspace?.id ?? null);
```
`refetch` is available but never destructured. `CreateGroupDialog` at `layout.tsx:231` has no way to trigger it.

## Solution
Pass `refetch` as `onGroupCreated` prop to `CreateGroupDialog`. Call it after RPC succeeds, before navigating.

## Related Files
- `src/app/chat/layout.tsx` — mounts `CreateGroupDialog`, has `useConversations`
- `src/components/sidebar/create-group-dialog.tsx` — needs `onGroupCreated` prop

## Implementation Steps

### Step 1 — Destructure `refetch` in `layout.tsx`

**File:** `src/app/chat/layout.tsx` — line 32

Change:
```ts
const { conversations } = useConversations(activeWorkspace?.id ?? null);
```
To:
```ts
const { conversations, refetch: refetchConversations } = useConversations(activeWorkspace?.id ?? null);
```

### Step 2 — Pass `refetch` to `CreateGroupDialog` in `layout.tsx`

**File:** `src/app/chat/layout.tsx` — line 231–236

Change:
```tsx
{showCreateGroup && activeWorkspace && (
  <CreateGroupDialog
    currentUserId={currentUser.id}
    workspaceId={activeWorkspace.id}
    onClose={() => setShowCreateGroup(false)}
  />
)}
```
To:
```tsx
{showCreateGroup && activeWorkspace && (
  <CreateGroupDialog
    currentUserId={currentUser.id}
    workspaceId={activeWorkspace.id}
    onClose={() => setShowCreateGroup(false)}
    onGroupCreated={refetchConversations}
  />
)}
```

### Step 3 — Add `onGroupCreated` prop to `CreateGroupDialog`

**File:** `src/components/sidebar/create-group-dialog.tsx`

Add to `CreateGroupDialogProps` interface:
```ts
onGroupCreated?: () => void;
```

Add to destructured props:
```ts
export function CreateGroupDialog({
  currentUserId,
  workspaceId,
  onClose,
  onGroupCreated,   // ← add
}: CreateGroupDialogProps)
```

### Step 4 — Call `onGroupCreated` after RPC succeeds

**File:** `src/components/sidebar/create-group-dialog.tsx` — `handleCreate` function

Change:
```ts
onClose();
router.push(`/chat/${conversationId}`);
```
To:
```ts
onGroupCreated?.();   // ← immediately refetch sidebar
onClose();
router.push(`/chat/${conversationId}`);
```

## Success Criteria
- After creating a group, it appears in sidebar instantly (no perceptible delay)
- Navigating to the new group chat shows it highlighted in sidebar

## Risk
Low. Prop addition is purely additive. `refetch` is already a stable `useCallback`.
