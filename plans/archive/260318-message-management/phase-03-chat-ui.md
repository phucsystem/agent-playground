# Phase 03: Chat UI

**Priority:** High (core user-facing feature)
**Status:** ⏳
**Effort:** M
**Depends on:** Phase 02

## Context

- `message-item.tsx` renders individual messages with content routing by type
- `chat-input.tsx` handles text entry, file uploads, mentions, emojis, GIFs
- Current message-item has no context menu or action buttons beyond ❤️ heart
- Layout: current user messages right-aligned (blue), others left-aligned (gray)
- Edit mode needs to repurpose chat-input with pre-filled content

## Requirements

- Message context menu (right-click or hover "..." button) with Edit/Delete options
- Edit mode: inline editing within message bubble OR chat-input pre-fill
- Delete confirmation dialog
- "Edited" badge on edited messages
- "This message was deleted" placeholder for deleted messages
- Only show Edit on own messages; Delete on own OR if conversation admin

## Related Code Files

- `src/components/chat/message-item.tsx` — context menu, edited badge, deleted state
- `src/components/chat/message-list.tsx` — pass edit/delete handlers, edit state
- `src/components/chat/chat-input.tsx` — edit mode with pre-fill + cancel
- `src/app/chat/[conversationId]/page.tsx` — wire edit/delete state

## Implementation Steps

### Message Item Changes (`message-item.tsx`)

- [ ] Add message action menu (hover → "..." button → dropdown)
  - "Edit" — only if `isCurrentUser && !message.is_deleted`
  - "Delete" — if `isCurrentUser || isConversationAdmin`
  - Position: above message bubble, opposite side of heart button

- [ ] Add "edited" badge
  - Show small "edited" text next to timestamp when `message.edited_at` is set
  - Style: muted text, italic, smaller font

- [ ] Add deleted message state
  - When `message.is_deleted === true`: render placeholder
  - Style: italic, muted, no bubble color
  - Text: "This message was deleted"
  - No reactions, no context menu on deleted messages

### Message List Changes (`message-list.tsx`)

- [ ] Add new props:
  ```typescript
  editingMessageId: string | null;
  onStartEdit: (messageId: string) => void;
  onCancelEdit: () => void;
  onConfirmEdit: (messageId: string, newContent: string) => void;
  onDeleteMessage: (messageId: string) => void;
  isConversationAdmin: boolean;
  ```
- [ ] Pass to MessageItem components

### Chat Input Edit Mode (`chat-input.tsx`)

- [ ] Add props:
  ```typescript
  editingMessage?: { id: string; content: string } | null;
  onCancelEdit?: () => void;
  ```
- [ ] When `editingMessage` is set:
  - Pre-fill textarea with message content
  - Show "Editing message" banner above input with cancel (X) button
  - Change send button label/icon to "Save" / check icon
  - On submit: call `onConfirmEdit(editingMessage.id, newContent)` instead of sendMessage
  - Escape key cancels edit mode
  - Disable file upload, emoji, GIF pickers during edit mode

### Conversation Page Wiring (`[conversationId]/page.tsx`)

- [ ] Add state: `editingMessageId: string | null`
- [ ] Wire `onStartEdit` → set editingMessageId
- [ ] Wire `onCancelEdit` → clear editingMessageId
- [ ] Wire `onConfirmEdit` → call `editMessage()` from hook, clear editingMessageId
- [ ] Wire `onDeleteMessage` → show confirmation toast/dialog, then call `deleteMessage()`
- [ ] Pass `isConversationAdmin` (derive from conversation members + current user role)

### Delete Confirmation

- [ ] Use Sonner toast with action button OR simple confirm dialog
  - "Delete this message? This cannot be undone."
  - Actions: "Delete" (destructive red) / "Cancel"

## UI Mockup

```
┌─────────────────────────────────────────┐
│ [Message from other user]               │
│   "Hello, how are you?"                 │
│   10:30 AM                              │
│                                         │
│          [Your message]        [...] ❤️ │
│          "I'm doing great!"             │
│          10:31 AM · edited              │
│                                         │
│   [Deleted message]                     │
│   This message was deleted              │
│   10:32 AM                              │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ✏️ Editing message              [X] │ │
│ │ I'm doing great, thanks!            │ │
│ │                          [✓ Save]   │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘

Context menu (hover "..."):
┌──────────┐
│ ✏️ Edit  │
│ 🗑 Delete │
└──────────┘
```

## Success Criteria

- Users can edit own text messages (not file/image/url types)
- "Edited" badge visible on edited messages
- Deleted messages show placeholder
- Context menu only shows allowed actions per permissions
- Edit mode pre-fills chat input, Escape cancels
- Delete shows confirmation before executing
- Smooth animations/transitions
