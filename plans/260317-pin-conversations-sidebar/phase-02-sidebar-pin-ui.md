---
phase: 2
priority: high
status: completed
effort: M
---

# Phase 2: Sort Logic + Pin UI in Sidebar

## Overview

Modify `conversation-list.tsx` to sort pinned conversations to top and show pin/unpin icon on hover. Pass `currentUserId` from `sidebar.tsx`.

## Related Code Files

- **Modify:** `src/components/sidebar/conversation-list.tsx`
- **Modify:** `src/components/sidebar/sidebar.tsx`

## Implementation Steps

### 1. Update `sidebar.tsx` — pass `currentUserId`

Add `currentUserId={currentUser.id}` prop to `<ConversationList>`.

### 2. Update `ConversationList` — accept `currentUserId`, add sort logic

```typescript
interface ConversationListProps {
  conversations: ConversationWithDetails[];
  activeConversationId?: string;
  onlineUserIds: string[];
  currentUserId: string; // NEW
}
```

#### Sort helper function

```typescript
function sortWithPins(
  conversations: ConversationWithDetails[],
  pinnedIds: string[]
): ConversationWithDetails[] {
  const pinnedSet = new Set(pinnedIds);
  const pinned = conversations
    .filter((conv) => pinnedSet.has(conv.id))
    .sort((a, b) => {
      const nameA = a.name || a.other_user?.display_name || "";
      const nameB = b.name || b.other_user?.display_name || "";
      return nameA.localeCompare(nameB);
    });
  const unpinned = conversations.filter((conv) => !pinnedSet.has(conv.id));
  // unpinned already sorted by updated_at DESC from DB
  return [...pinned, ...unpinned];
}
```

#### In ConversationList body

```typescript
const { pinnedIds, togglePin, isPinned, cleanStalePins } = usePinnedConversations(currentUserId);

// Clean stale pins on conversation list change
useEffect(() => {
  const validIds = conversations.map((conv) => conv.id);
  cleanStalePins(validIds);
}, [conversations, cleanStalePins]);

const sortedDMs = sortWithPins(dmConversations, pinnedIds);
const sortedGroups = sortWithPins(activeGroups, pinnedIds);
```

#### Visual separator between pinned and unpinned

Within each section, after rendering pinned items, insert a thin `<hr>` separator if there are both pinned and unpinned items in that section.

```typescript
function renderConversationSection(
  convs: ConversationWithDetails[],
  pinnedSet: Set<string>,
  /* other props */
) {
  const hasPinned = convs.some((c) => pinnedSet.has(c.id));
  const hasUnpinned = convs.some((c) => !pinnedSet.has(c.id));
  const showSeparator = hasPinned && hasUnpinned;

  return convs.map((conv, index) => {
    const isFirstUnpinned = showSeparator && !pinnedSet.has(conv.id)
      && (index === 0 || pinnedSet.has(convs[index - 1].id));
    return (
      <>
        {isFirstUnpinned && (
          <div className="mx-2 my-1 border-t border-neutral-200" />
        )}
        <ConversationItem
          key={conv.id}
          conversation={conv}
          isActive={conv.id === activeConversationId}
          isOnline={...}
          isPinned={pinnedSet.has(conv.id)}
          onTogglePin={() => togglePin(conv.id)}
        />
      </>
    );
  });
}
```

### 3. Update `ConversationItem` — add pin icon

Add `isPinned` and `onTogglePin` props.

```typescript
function ConversationItem({
  conversation,
  isActive,
  isOnline,
  isPinned,
  onTogglePin,
}: {
  conversation: ConversationWithDetails;
  isActive: boolean;
  isOnline: boolean;
  isPinned: boolean;
  onTogglePin: () => void;
}) {
```

#### Pin icon placement

Place pin icon between the conversation info and the unread badge. Show on hover via `group` + `group-hover:` Tailwind pattern.

```tsx
<Link
  href={`/chat/${conversation.id}`}
  className={`group flex items-center gap-2.5 px-2 py-2 rounded-lg transition ${...}`}
>
  {/* avatar */}
  {/* content div */}

  {/* Pin button — visible on hover OR when pinned */}
  <button
    onClick={(event) => {
      event.preventDefault();
      event.stopPropagation();
      onTogglePin();
    }}
    className={`shrink-0 p-0.5 rounded transition ${
      isPinned
        ? "text-primary-400 opacity-100"
        : "text-neutral-400 opacity-0 group-hover:opacity-100"
    } hover:text-primary-500`}
    title={isPinned ? "Unpin" : "Pin"}
  >
    <Pin className="w-3.5 h-3.5" />
  </button>

  {/* unread badge */}
</Link>
```

- Import `Pin` from `lucide-react`
- When `isPinned`: icon always visible with primary color
- When not pinned: icon only visible on hover (opacity-0 → group-hover:opacity-100)
- `event.preventDefault()` + `stopPropagation()` prevents navigation when clicking pin

### 4. Import updates

```typescript
import { Pin } from "lucide-react";  // add to conversation-list.tsx imports
import { useEffect } from "react";
import { usePinnedConversations } from "@/hooks/use-pinned-conversations";
```

## Todo

- [ ] Add `currentUserId` prop to ConversationList + pass from sidebar.tsx
- [ ] Import and use `usePinnedConversations` hook
- [ ] Implement `sortWithPins` helper
- [ ] Add `useEffect` for `cleanStalePins`
- [ ] Update ConversationItem with pin icon (hover + always-on for pinned)
- [ ] Add visual separator between pinned/unpinned
- [ ] Test: pin/unpin DM, pin/unpin group, reload page, verify persistence

## Edge Cases

- Pin icon click must NOT navigate (preventDefault + stopPropagation)
- Unread badge and pin icon must not overlap — pin goes before badge
- On touch devices, `group-hover` won't apply — pinned icon always visible via `isPinned` condition

## Success Criteria

- Pinned conversations float to top of DMs and Groups sections
- Pin icon appears on hover, stays visible when pinned
- Thin separator between pinned and unpinned items
- Clicking pin icon toggles state without navigating
- No layout shift or overflow in 260px sidebar
