---
phase: 2
title: "Backend Hooks"
status: pending
effort: 1.5h
---

# Phase 2: Backend Hooks

## Context Links
- Phase 1 migration: `plans/260321-conversation-soft-leave/phase-01-database.md`
- Existing hooks pattern: `src/hooks/use-conversations.ts`
- Types: `src/types/database.ts`

## Overview
- **Priority:** High (blocks UI phases)
- **Status:** Pending
- Create `use-leave-conversation` hook, update types, add left conversations query

## Key Insights
- Follow existing hook patterns: React Query for data, Supabase RPC calls
- `use-conversations` already calls `get_my_conversations` RPC - no change needed since RPC handles filtering
- Need separate hook/query for left conversations (different RPC)
- Realtime: `conversation_members` UPDATE events already propagate (migration 022). When `left_at` changes, invalidate conversations query.

## Architecture

### New Hook: `use-leave-conversation`
```typescript
// Simple RPC wrapper
export function useLeaveConversation() {
  async function leaveConversation(conversationId: string): Promise<{ success: boolean; error?: string }>
  // Calls supabase.rpc('leave_conversation', { conv_id })
  // Invalidates conversations query
  // Redirects to /chat
}
```

### New Hook: `use-left-conversations`
```typescript
export function useLeftConversations(workspaceId: string | null) {
  // useQuery(['left-conversations', workspaceId], ...)
  // Calls supabase.rpc('get_left_conversations', { ws_id })
  // Returns { leftConversations, loading }
}
```

### Type Updates
```typescript
// database.ts
export interface ConversationMember {
  // ... existing fields
  left_at: string | null;  // ADD
}

export interface ConversationWithDetails extends Conversation {
  // ... existing fields
  left_at?: string | null;  // ADD - from get_left_conversations
}

// Functions type
export interface Database {
  public: {
    Functions: {
      // ADD:
      leave_conversation: { Args: { conv_id: string }; Returns: void };
      get_left_conversations: { Args: { ws_id?: string }; Returns: ConversationWithDetails[] };
      reinvite_member: { Args: { conv_id: string; target_user_id: string }; Returns: void };
    }
  }
}
```

## Related Code Files

### Create
- `src/hooks/use-leave-conversation.ts` (~30 lines)
- `src/hooks/use-left-conversations.ts` (~30 lines)

### Modify
- `src/types/database.ts` (add `left_at`, add function signatures)

## Implementation Steps

1. **Update types** (`src/types/database.ts`):
   - [ ] Add `left_at: string | null` to `ConversationMember`
   - [ ] Add `left_at?: string | null` to `ConversationWithDetails`
   - [ ] Add `leave_conversation`, `get_left_conversations`, `reinvite_member` to Functions

2. **Create `use-leave-conversation.ts`**:
   - [ ] Export `useLeaveConversation()` hook
   - [ ] Call `supabase.rpc('leave_conversation', { conv_id })`
   - [ ] On success: invalidate `['conversations', workspaceId]` and `['left-conversations', workspaceId]`
   - [ ] Return `{ leaveConversation, leaving }` (loading state)

3. **Create `use-left-conversations.ts`**:
   - [ ] Export `useLeftConversations(workspaceId)` hook
   - [ ] `useQuery(['left-conversations', workspaceId], ...)` calling `get_left_conversations` RPC
   - [ ] Subscribe to `conversation_members` UPDATE for realtime invalidation
   - [ ] Return `{ leftConversations, loading }`

## Success Criteria
- `useLeaveConversation` successfully calls RPC and invalidates cache
- `useLeftConversations` returns left conversations for current workspace
- Types compile without errors
- Realtime updates reflect leave/rejoin immediately

## Risk Assessment
- Minimal risk - follows established hook patterns exactly
- Cache invalidation covers both active and left conversation lists
