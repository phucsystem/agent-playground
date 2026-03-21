---
phase: 3
title: "Sidebar UI - Deleted Section"
status: pending
effort: 1.5h
---

# Phase 3: Sidebar UI - Deleted Section

## Context Links
- Conversation list: `src/components/sidebar/conversation-list.tsx`
- Chat info panel: `src/components/chat/chat-info-panel.tsx`
- Sidebar: `src/components/sidebar/sidebar.tsx`
- Archive pattern: same file, `showArchived` toggle

## Overview
- **Priority:** Medium
- **Status:** Pending
- Add "Deleted" section to sidebar, add "Delete conversation" action to info panel for all conversation types

## Key Insights
- Follow existing **archive toggle pattern** in `conversation-list.tsx` (lines 178-189): localStorage toggle, icon button in section header
- Current info panel has "Leave group" (hard delete from members) for groups and "Delete conversation" (admin hard delete) for DMs. Replace both with soft-leave.
- "Deleted" section renders at bottom of sidebar, below Groups. Shows left conversations as read-only items.
- Left conversations: no pin, no drag, no unread badge. Just name + "left" indicator.
- Use `Trash2` icon for the deleted section toggle (consistent with delete semantics).

## Architecture

### Sidebar Flow
```
conversation-list.tsx
  |-- CollapsibleSection "Direct Messages" (active DMs)
  |-- CollapsibleSection "Groups" (active groups + archived toggle)
  |-- [NEW] CollapsibleSection "Deleted" (left conversations - toggle visibility)
```

### Data Flow
```
sidebar.tsx
  -> useLeftConversations(workspaceId)  [NEW]
  -> passes leftConversations to ConversationList
  -> ConversationList renders "Deleted" section
```

### Info Panel Changes
- **Groups**: Replace `handleLeaveGroup()` (hard delete from members) with soft-leave via `useLeaveConversation`
- **DMs**: Add "Delete conversation" button (for non-admins) that calls soft-leave
- **Admin hard delete**: Keep existing for system admins as additional option
- Add confirmation dialog before leave (reuse `confirm-delete-dialog.tsx` pattern or inline confirm)

## Related Code Files

### Modify
- `src/components/sidebar/conversation-list.tsx` - Add "Deleted" section with left conversations
- `src/components/sidebar/sidebar.tsx` - Pass left conversations data
- `src/components/chat/chat-info-panel.tsx` - Replace hard leave with soft-leave, add leave for DMs

## Implementation Steps

1. **Update `sidebar.tsx`**:
   - [ ] Import and call `useLeftConversations(workspaceId)`
   - [ ] Pass `leftConversations` as prop to `ConversationList`

2. **Update `conversation-list.tsx`**:
   - [ ] Add `leftConversations` to `ConversationListProps`
   - [ ] Add localStorage toggle for "Deleted" section (follow `showArchived` pattern)
   - [ ] Render `CollapsibleSection "Deleted"` at bottom with `Trash2` icon toggle
   - [ ] Left conversation items: non-draggable, no pin, muted styling, no unread badge
   - [ ] Show DMs and groups together in deleted section (sorted by `left_at` descending)

3. **Update `chat-info-panel.tsx`**:
   - [ ] Import `useLeaveConversation` hook
   - [ ] Replace `handleLeaveGroup` (hard delete) with soft-leave call
   - [ ] Add "Delete conversation" button for DMs (non-admin users)
   - [ ] Keep admin hard delete as separate option for system admins
   - [ ] Add confirmation: "Delete this conversation? It will move to your Deleted section."
   - [ ] On leave success: `router.push('/chat')` and invalidate conversations

## UI Design

### Deleted Section Toggle
Same pattern as Archive toggle in Groups section header:
```
[Trash2 icon button] - toggles deleted section visibility
```

### Deleted Conversation Item
- Muted text (text-neutral-400)
- No pin button, no drag handle
- No unread badge
- Click navigates to conversation (read-only mode handled by Phase 4)
- Small "left" or timestamp label

### Info Panel Leave Button
```
[LogOut icon] Delete conversation
  -> Confirmation dialog
  -> Calls leave_conversation RPC
  -> Redirects to /chat
```

For groups, relabel from "Leave group" to "Delete conversation" for consistency.

## Success Criteria
- Left conversations appear in "Deleted" section when toggled visible
- "Delete conversation" works for both DMs and groups
- Confirmation dialog shown before leave
- Left conversations disappear from active list immediately
- Realtime: other members see updated member count

## Risk Assessment
- `conversation-list.tsx` is already 459 lines. Adding deleted section may push over 200-line limit. Consider extracting `DeletedSection` as separate component if needed.
- Info panel is 602 lines. The leave logic replacement is minimal (swap function body).
