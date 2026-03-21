# Phase 02: API & Hooks

**Priority:** High (blocks UI phase)
**Status:** ⏳
**Effort:** S
**Depends on:** Phase 01

## Context

- Messages are sent/fetched via Supabase client directly (no Next.js API routes for messages)
- React Query v5 with infinite query for messages (`use-realtime-messages.ts`)
- Pattern: hooks return data + mutation functions, components receive via props
- Existing hook returns: `{ messages, loading, hasMore, loadMore, markAsRead, addOptimisticMessage }`

## Requirements

- Hook must expose `editMessage(msgId, newContent)` and `deleteMessage(msgId)` functions
- Optimistic cache updates for both operations
- Revert on error

## Related Code Files

- `src/hooks/use-realtime-messages.ts` — add edit/delete mutations
- `src/types/database.ts` — update Message type

## Implementation Steps

### Update Types (`src/types/database.ts`)

- [ ] Add `edited_at: string | null` to Message interface
- [ ] Add `is_deleted: boolean` to Message interface

### Add Mutations to `use-realtime-messages.ts`

- [ ] Add `editMessage(messageId: string, newContent: string)` function
  - Optimistic update: set content + edited_at in cache via `setQueryData`
  - Call `supabase.rpc('edit_message', { msg_id, new_content })`
  - On error: revert cache to previous state
  - Return: `{ success: boolean, error?: string }`

- [ ] Add `deleteMessage(messageId: string)` function
  - Optimistic update: set is_deleted=true, content='' in cache via `setQueryData`
  - Call `supabase.rpc('delete_message', { msg_id })`
  - On error: revert cache to previous state
  - Return: `{ success: boolean, error?: string }`

### Cache Update Helper

```typescript
function updateMessageInCache(
  queryClient: QueryClient,
  conversationId: string,
  messageId: string,
  updater: (msg: MessageWithSender) => MessageWithSender
) {
  queryClient.setQueryData(
    ["messages", conversationId],
    (oldData: InfiniteData<MessageWithSender[]> | undefined) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map(page =>
          page.map(msg => msg.id === messageId ? updater(msg) : msg)
        ),
      };
    }
  );
}
```

### Updated Hook Return Type

```typescript
{
  messages: MessageWithSender[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  markAsRead: () => void;
  addOptimisticMessage: (msg: MessageWithSender) => void;
  editMessage: (messageId: string, newContent: string) => Promise<{ success: boolean; error?: string }>;
  deleteMessage: (messageId: string) => Promise<{ success: boolean; error?: string }>;
}
```

## Success Criteria

- editMessage updates cache immediately, calls RPC, reverts on failure
- deleteMessage updates cache immediately, calls RPC, reverts on failure
- TypeScript types updated with new fields
- No breaking changes to existing hook consumers
