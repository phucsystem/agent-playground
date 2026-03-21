# Phase 2: Migrate useConversations to React Query

## Overview
- **Priority:** High
- **Status:** Completed
- **Effort:** 2h
- **Depends on:** Phase 1

Replace manual `useState`+`useEffect` fetch pattern in `use-conversations.ts` with `useQuery`. Realtime subscriptions write to cache via `invalidateQueries` instead of full refetch cycle.

## Key Insights

- Current hook: workspace switch triggers `setConversations([])` + `setLoading(true)` -- this causes blank sidebar
- With React Query: switching workspace key `['conversations', wsId]` returns stale cached data immediately while refetching in background
- Current realtime: 6 separate `.on()` handlers ALL call `fetchConversations()` -- massive over-fetching
- Conversations use Supabase RPC `get_my_conversations({ ws_id: workspaceId })` -- keep this, just wrap in queryFn
- `ConversationsProvider` uses `key={activeWorkspace?.id}` on mount -- this causes full remount. With React Query cache, we can remove the key prop since cache handles workspace isolation via query key

## Requirements

### Functional
- FR-1: Conversation list displays instantly from cache on workspace switch
- FR-2: Background refetch updates list without blanking UI
- FR-3: Realtime events (INSERT/UPDATE/DELETE on conversations, messages, members) trigger cache invalidation
- FR-4: `ConversationsProvider` API unchanged: `{ conversations, loading, refetch }`

### Non-Functional
- NFR-1: No full refetch on every message INSERT (invalidation + staleTime debounces naturally)
- NFR-2: Cached data available for 30min after workspace switch

## Architecture

```
ConversationsProvider
  └── useConversationsQuery(workspaceId)
        ├── queryKey: ['conversations', workspaceId]
        ├── queryFn: supabase.rpc('get_my_conversations', { ws_id })
        ├── staleTime: 30_000 (30s -- conversations change often)
        └── enabled: !!workspaceId

  └── useEffect (realtime subscription)
        ├── on INSERT/UPDATE/DELETE conversations → invalidateQueries
        ├── on INSERT messages → invalidateQueries
        └── on INSERT/DELETE conversation_members → invalidateQueries
```

## Related Code Files

### Files to Modify
- `src/hooks/use-conversations.ts` -- Complete rewrite
- `src/contexts/conversations-context.tsx` -- Update to use new hook, remove `key` prop requirement
- `src/app/chat/layout.tsx` -- Remove `key={activeWorkspace?.id}` from ConversationsProviderWrapper

### Files Unchanged (but verify)
- `src/components/sidebar/conversation-list.tsx` -- Receives `conversations` prop, no change needed
- `src/components/sidebar/sidebar.tsx` -- Receives `conversations` prop, no change needed

## Implementation Steps

### 1. Rewrite `src/hooks/use-conversations.ts`

```ts
"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ConversationWithDetails } from "@/types/database";

export function useConversations(workspaceId: string | null) {
  const queryClient = useQueryClient();

  const { data: conversations = [], isLoading: loading } = useQuery({
    queryKey: ["conversations", workspaceId],
    queryFn: async () => {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.rpc("get_my_conversations", {
        ws_id: workspaceId!,
      });
      if (error) throw error;
      return Array.isArray(data)
        ? (data as ConversationWithDetails[])
        : (JSON.parse(data as string) as ConversationWithDetails[]);
    },
    enabled: !!workspaceId,
    staleTime: 30_000,
  });

  // Realtime subscriptions -- invalidate cache instead of full refetch
  useEffect(() => {
    if (!workspaceId) return;

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`conversation-updates-${workspaceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["conversations", workspaceId],
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversations",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["conversations", workspaceId],
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["conversations", workspaceId],
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "conversations",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["conversations", workspaceId],
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_members" },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["conversations", workspaceId],
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "conversation_members" },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["conversations", workspaceId],
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [workspaceId, queryClient]);

  const refetch = () => {
    queryClient.invalidateQueries({
      queryKey: ["conversations", workspaceId],
    });
  };

  return { conversations, loading, refetch };
}
```

**Key differences from current:**
- No `setConversations([])` on workspace switch -- React Query returns cached data for previous key
- `invalidateQueries` instead of direct `fetchConversations()` -- React Query deduplicates concurrent invalidations
- `enabled: !!workspaceId` prevents fetch when null

### 2. Update `src/contexts/conversations-context.tsx`

Minimal change -- hook return shape is identical (`{ conversations, loading, refetch }`). No changes needed to the context type or provider.

### 3. Remove `key` prop from ConversationsProviderWrapper

In `src/app/chat/layout.tsx`, change:
```tsx
// Before
<ConversationsProvider key={activeWorkspace?.id ?? "none"} workspaceId={activeWorkspace?.id ?? null}>

// After
<ConversationsProvider workspaceId={activeWorkspace?.id ?? null}>
```

The `key` prop forced remounting on workspace switch, destroying all state. React Query handles workspace isolation via `queryKey: ['conversations', workspaceId]` -- no remount needed.

**Impact:** This also preserves the `PresenceProvider`, `AgentHealthContext`, etc. state across workspace switches.

### 4. Verify `refetch` callers still work

Grep for `refetchConversations` usage:
- `CreateGroupDialog` calls `onGroupCreated={refetchConversations}` -- still works (calls `invalidateQueries`)

### 5. Test scenarios

- Switch workspace A -> B -> A: sidebar should show cached data instantly
- Send message in conversation: sidebar updates last_message via invalidation
- Create group: sidebar adds new conversation
- Receive realtime message from other user: sidebar updates

## Todo List

- [x] Rewrite `src/hooks/use-conversations.ts` with useQuery
- [x] Remove `key` prop from ConversationsProviderWrapper in chat/layout.tsx
- [x] Verify conversations-context.tsx needs no type changes
- [x] Test workspace switching -- cached data shows immediately
- [x] Test realtime -- new messages/conversations appear
- [x] Test group creation flow
- [x] Verify build compiles

## Success Criteria

- Workspace switch shows stale conversation list immediately (no blank)
- Background refetch updates silently
- Realtime events still trigger list updates
- No regression in conversation ordering, pins, or archive behavior

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Removing `key` prop breaks context isolation | Medium -- other contexts in wrapper tree affected | Only ConversationsProvider was keyed; other providers already handle workspace changes via their own hooks |
| Message INSERT invalidation too frequent | Low -- staleTime + React Query dedup handles this | If problematic, debounce invalidation with `setTimeout` wrapper |
| `refetch` callers expect synchronous behavior | Low -- `invalidateQueries` is async but callers don't await | Verify CreateGroupDialog flow still works |
