---
phase: 4
title: "Chat Read-Only Mode"
status: pending
effort: 1h
---

# Phase 4: Chat Read-Only Mode for Left Conversations

## Context Links
- Conversation page: `src/app/chat/[conversationId]/page.tsx`
- Chat input: `src/components/chat/chat-input.tsx`
- Chat header: `src/components/chat/chat-header.tsx`
- Archive read-only pattern: `page.tsx` lines 199-203

## Overview
- **Priority:** Medium
- **Status:** Pending
- When viewing a left conversation, show read-only banner and hide chat input. Follow existing `is_archived` pattern.

## Key Insights
- **Existing pattern**: `is_archived` check on conversation page already shows a read-only banner and hides `ChatInput`. Reuse exact same pattern for left conversations.
- Need to determine if current user has left: check `left_at` from conversation data or separate membership check.
- Approach: `get_left_conversations` returns `left_at` field. If user navigates to a conversation that's in their "left" list, show read-only mode.
- Alternative simpler approach: add `left_at` to `get_my_conversations` return (always null for active). Then the `conversation` object from context already has the info. But this breaks separation since `get_my_conversations` filters out left convos.
- **Best approach**: On conversation page, check if conversationId is NOT in active conversations list. If not found in active list but page loads (user has read access via RLS), it's a left conversation. Use `useLeftConversations` to confirm.
- **Simplest approach**: Add a lightweight RPC or direct query: check `conversation_members` for current user + conversation where `left_at IS NOT NULL`. Or just check: if `conversation` is not found in `conversations` from context, it's a left one.

### Decision: Use membership check
The conversation page already fetches `members` via `useConversationMembers`. Extend this hook to also return the current user's `left_at`. If `left_at` is set, show read-only mode.

## Architecture

### Conversation Page Logic
```typescript
// In ConversationPage:
const currentMembership = members.find(m => m.user_id === currentUser.id);
const hasLeft = currentMembership?.left_at !== null && currentMembership?.left_at !== undefined;

// OR simpler: conversation not found in active list
const hasLeft = !conversation; // conversation from useConversationsContext

// Then in render:
{(conversation?.is_archived || hasLeft) ? (
  <ReadOnlyBanner type={hasLeft ? 'left' : 'archived'} />
) : (
  <ChatInput ... />
)}
```

### Get Conversation Members Update
The `get_conversation_members` RPC (migration 022) already returns `last_read_at`. It also needs to return `left_at`.

Wait - the RPC filters `u.is_active = true` but doesn't filter by `left_at`. Left members will still appear in member list. This is correct (they were members). But the frontend hook needs to expose `left_at`.

Update: `get_conversation_members` already returns all columns from `conversation_members`. Adding `left_at` column means it's automatically included. Just need to update the RETURNS TABLE to include `left_at`.

### Issue: Left member may not see conversation via `get_my_conversations`
Since `get_my_conversations` excludes left conversations, the `conversation` object from `useConversationsContext` will be `null` for left conversations. The page currently shows "Loading conversation..." when conversation is null.

**Solution**: On conversation page, if `conversation` is null and user navigates directly (e.g., from "Deleted" section), fetch conversation data separately via `get_left_conversations` or a direct query.

**Simpler solution**: In the conversation page, if `conversation` is null after loading, check if it's a left conversation and show appropriate UI.

**Simplest**: Combine active + left conversations in context. `useConversationsContext` could expose both. Or: add `leftConversations` to the conversations context.

### Final Approach
1. In `conversations-context.tsx` (or wherever conversations are provided), also provide `leftConversations` from `useLeftConversations`
2. In conversation page, look up conversation in both active and left lists
3. If found in left list, set `hasLeft = true` and render read-only

## Related Code Files

### Modify
- `src/app/chat/[conversationId]/page.tsx` - Add read-only mode for left conversations
- `src/components/chat/chat-header.tsx` - Optional "You left" indicator
- `src/contexts/conversations-context.tsx` (if exists) - Provide left conversations
- `supabase/migrations/024_conversation_soft_leave.sql` - Update `get_conversation_members` to return `left_at`

### Check
- `src/hooks/use-conversation-members.ts` - Verify `left_at` propagates through the hook

## Implementation Steps

1. **Update migration** (Phase 1 SQL file):
   - [ ] Update `get_conversation_members` to include `left_at` in RETURNS TABLE

2. **Update `use-conversation-members.ts`**:
   - [ ] Add `left_at` to `MemberWithUser` and `RpcMemberRow` interfaces

3. **Update conversations context** to include left conversations:
   - [ ] Import `useLeftConversations`
   - [ ] Expose `leftConversations` from context

4. **Update `[conversationId]/page.tsx`**:
   - [ ] Get `leftConversations` from context
   - [ ] Check if current conversation is in left list
   - [ ] If left: show read-only banner (reuse archive banner pattern)
   - [ ] If left: hide `ChatInput`, show "You left this conversation" banner

5. **Update `chat-header.tsx`** (optional enhancement):
   - [ ] If conversation is left, show subtle "Left" badge or dimmed state

## UI Design

### Read-Only Banner (left conversation)
Follow exact pattern of archive banner (line 199-203 of page.tsx):
```tsx
<div className="mx-2 sm:mx-4 md:mx-6 mb-2 md:mb-4 px-4 py-3 bg-neutral-100 rounded-2xl text-center">
  <p className="text-sm text-neutral-500">
    You left this conversation. You can read messages but cannot send new ones.
  </p>
</div>
```

## Success Criteria
- Left conversations load in read-only mode (no chat input)
- Banner message clearly indicates left state
- Navigation from "Deleted" sidebar section works correctly
- Messages remain readable (scroll, load more works)

## Risk Assessment
- Need to handle case where conversation is not in either active or left list (deleted by admin) - show "Conversation not found"
- `conversations-context.tsx` exists (verified). It wraps `useConversations` and exposes `{ conversations, loading, refetch }`. Adding `leftConversations` is straightforward: import `useLeftConversations`, spread into context value.
