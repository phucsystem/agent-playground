# Phase 04: Realtime Sync

**Priority:** High (messages must sync across clients)
**Status:** ⏳
**Effort:** S
**Depends on:** Phase 02, Phase 03

## Context

- `use-realtime-messages.ts` subscribes to `postgres_changes` INSERT on messages table
- Realtime publication already includes messages table (`ALTER PUBLICATION supabase_realtime ADD TABLE messages`)
- Current subscription only handles INSERT events — no UPDATE or DELETE
- Cache updates use `setQueryData` with infinite query pages

## Requirements

- Subscribe to UPDATE events on messages (for edits)
- Subscribe to UPDATE events on messages where is_deleted changes (for deletes)
- Update React Query cache surgically (no full refetch)
- Handle race conditions: local optimistic update vs server realtime event

## Related Code Files

- `src/hooks/use-realtime-messages.ts` — add UPDATE subscription handler

## Implementation Steps

### Add UPDATE Subscription (`use-realtime-messages.ts`)

- [ ] Extend existing channel subscription to include UPDATE events:
  ```typescript
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}`
  }, handleMessageUpdate)
  ```

- [ ] Implement `handleMessageUpdate(payload)`:
  ```typescript
  const handleMessageUpdate = (payload: RealtimePostgresChangesPayload<Message>) => {
    const updatedMessage = payload.new;

    queryClient.setQueryData(
      ["messages", conversationId],
      (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map(page =>
            page.map(msg => {
              if (msg.id === updatedMessage.id) {
                return {
                  ...msg,
                  content: updatedMessage.content,
                  edited_at: updatedMessage.edited_at,
                  is_deleted: updatedMessage.is_deleted,
                  metadata: updatedMessage.metadata,
                };
              }
              return msg;
            })
          ),
        };
      }
    );
  };
  ```

### Deduplication with Optimistic Updates

- [ ] Skip cache update if message already matches (content + edited_at match)
- [ ] This prevents flicker when local optimistic update arrives before server realtime event

### Sidebar Last Message Update

- [ ] When a message is edited, the sidebar "last message" preview may be stale
- [ ] Invalidate conversations query on message UPDATE to refresh sidebar previews:
  ```typescript
  queryClient.invalidateQueries({ queryKey: ["conversations"] });
  ```

### Webhook Dispatch for UPDATE Events

- [ ] Update webhook-dispatch Edge Function to handle UPDATE events (separate concern, but note here)
- [ ] Supabase Database Webhooks can be configured for UPDATE on messages table
- [ ] Payload includes `message.updated` event type with old and new content

## Success Criteria

- Edit by User A → User B sees updated content in real-time
- Delete by User A → User B sees "deleted" placeholder in real-time
- No duplicate updates when local user edits (optimistic + realtime)
- Sidebar last message preview updates on edit
- < 500ms latency for edit/delete propagation
