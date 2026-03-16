# Phase 4: Polish

## Context
- SRD: FR-16 through FR-18 (Phase 3 features)
- UI Spec: Typing indicators, read receipts, reactions in S-03/S-04
- DB Design: reactions table, Broadcast channel for typing

## Overview
- **Priority:** P3
- **Status:** Pending
- **Effort:** 4h
- **Depends on:** Phase 3 (groups + files working)
- Add typing indicators, read receipts, message reactions.

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/chat/typing-indicator.tsx` | "User is typing..." display |
| `src/components/chat/message-reactions.tsx` | Emoji reactions on messages |
| `src/components/chat/reaction-picker.tsx` | Emoji picker popover |
| `src/hooks/use-typing-indicator.ts` | Send/receive typing broadcasts |
| `src/hooks/use-reactions.ts` | Add/remove reactions |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/chat/message-list.tsx` | Add typing indicator at bottom |
| `src/components/chat/message-item.tsx` | Add reactions display + hover toolbar |
| `src/components/chat/chat-input.tsx` | Emit typing event on keystroke |
| `src/hooks/use-conversations.ts` | Update unread count on read receipt |

## Implementation Steps

### Step 1: Typing indicators (FR-16)

`use-typing-indicator.ts`:
1. **Send**: On keystroke in chat input, broadcast typing event via Supabase Broadcast
2. Debounce: send max once per 2 seconds
3. Channel: `typing:{conversation_id}`
4. Payload: `{ user_id, display_name }`

5. **Receive**: Subscribe to broadcast typing events
6. Maintain `typingUsers` state (array of display names)
7. Auto-clear after 3 seconds of no typing event from same user

`typing-indicator.tsx`:
1. Show "Alice is typing..." (single user)
2. Show "Alice and Bob are typing..." (2 users)
3. Show "3 people are typing..." (3+)
4. Animated dots (reuse `.typing-dots` from prototypes)

`chat-input.tsx`:
1. On `onChange` → call `sendTyping()` from hook (debounced)

### Step 2: Read receipts (FR-17)

No separate read receipt UI for MVP. Implemented as unread count:
1. On conversation open → `mark_conversation_read` RPC (already done in Phase 2)
2. On new message received while conversation focused → `mark_conversation_read` again
3. Sidebar unread badge decrements accordingly

Future enhancement: show "read" checkmarks per message. Skip for MVP.

### Step 3: Message reactions (FR-18)

`use-reactions.ts`:
1. Fetch reactions with messages (join or separate query per conversation)
2. Add reaction: `POST /rest/v1/reactions`
3. Remove reaction: `DELETE /rest/v1/reactions?id=eq.{id}`
4. Listen for realtime: subscribe to `postgres_changes` on reactions table

`reaction-picker.tsx`:
1. Small popover with 6 quick emojis: 👍 ❤️ 😂 🎉 🤔 👀
2. Trigger: click emoji icon in message hover toolbar

`message-reactions.tsx`:
1. Show reaction pills below message content
2. Each pill: emoji + count (e.g., "👍 3")
3. Highlight if current user reacted
4. Click pill → toggle own reaction (add/remove)

`message-item.tsx`:
1. Add hover toolbar: emoji picker button + more options (⋮)
2. Show reactions below content if any exist

### Step 4: Enable reactions realtime

Add reactions table to realtime publication:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
```

Subscribe to reaction changes per conversation (filter by message conversation).

## Todo List

- [ ] Typing indicator hook (send + receive via Broadcast)
- [ ] Typing indicator UI component
- [ ] Integrate typing into chat input (debounced)
- [ ] Reaction picker (6 quick emojis)
- [ ] Reaction display pills on messages
- [ ] Add/remove reaction API integration
- [ ] Realtime reaction updates
- [ ] Hover toolbar on messages (emoji + more)
- [ ] Enable reactions table realtime

## Success Criteria

- Type in input → other participants see "X is typing..."
- Typing indicator disappears after 3s of inactivity
- Click emoji → reaction appears below message
- Click own reaction → removes it
- Reactions update in real-time for all participants
- Reaction count is accurate

## Risks

| Risk | Mitigation |
|------|------------|
| Typing broadcasts flood | Debounce at 2s. Broadcast is ephemeral (no persistence). |
| Reaction spam | One reaction type per user per message (DB constraint). |
