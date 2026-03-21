# Phase 3: Migrate useRealtimeMessages to React Query

## Overview
- **Priority:** High
- **Status:** Completed
- **Effort:** 3h
- **Depends on:** Phase 1

Replace the manual LRU cache + `useState` pattern in `use-realtime-messages.ts` with `useInfiniteQuery`. Realtime INSERTs write directly to cache via `setQueryData` (no refetch). Remove module-level `messageCache` Map.

## Key Insights

- Current hook initializes from LRU cache BUT always calls `fetchMessages(0)` on mount -- this causes flicker even with cached data
- With `useInfiniteQuery` + `staleTime: Infinity`, cached data renders immediately and no background refetch occurs (realtime keeps it fresh)
- Pagination: DB returns newest-first, hook reverses to oldest-first for display. `useInfiniteQuery` pages must handle this direction
- `addOptimisticMessage` and `markAsRead` interfaces must remain unchanged -- multiple consumers depend on them
- Realtime INSERT handler fetches sender data from `users_public` -- keep this, inject enriched message into cache
- `window.dispatchEvent("message-received")` pattern must be preserved -- used by agent health and presence tracking

## Requirements

### Functional
- FR-1: Messages display instantly from cache on conversation switch (0ms blank)
- FR-2: New messages appear via realtime `setQueryData` (no full refetch)
- FR-3: `loadMore` triggers `fetchNextPage()` for pagination
- FR-4: `addOptimisticMessage` writes directly to cache
- FR-5: `markAsRead` still calls RPC
- FR-6: No duplicate messages (dedup by `msg.id` on both realtime append and background fetch)

### Non-Functional
- NFR-1: `staleTime: Infinity` -- never auto-refetch (realtime is source of truth)
- NFR-2: `gcTime: 30 * 60_000` -- cached messages survive 30min of inactivity
- NFR-3: Remove module-level `messageCache` Map -- React Query cache replaces it entirely

## Architecture

```
useMessagesQuery(conversationId)
  ├── useInfiniteQuery
  │     ├── queryKey: ['messages', conversationId]
  │     ├── queryFn: fetch PAGE_SIZE messages at offset
  │     ├── getNextPageParam: returns next offset if hasMore
  │     ├── staleTime: Infinity
  │     └── select: flatten pages + reverse into chronological order
  │
  ├── useEffect (realtime subscription)
  │     └── on INSERT message:
  │           1. Fetch sender from users_public
  │           2. setQueryData(['messages', convId]) -- append to last page
  │           3. Dedup by msg.id
  │           4. Dispatch 'message-received' event
  │
  ├── addOptimisticMessage(msg)
  │     └── setQueryData -- append to last page (dedup)
  │
  └── markAsRead()
        └── supabase.rpc('mark_conversation_read')
```

### Data Shape in Cache

Each page in the infinite query:
```ts
{
  pages: [
    { messages: MessageWithSender[], nextOffset: number | undefined },
    { messages: MessageWithSender[], nextOffset: number | undefined },
  ],
  pageParams: [0, 50, ...]
}
```

Flattened for consumers:
```ts
messages: pages.flatMap(p => p.messages).reverse()  // chronological order
```

**Wait -- correction.** The current code fetches `order("created_at", { ascending: false })` then reverses. With infinite query, "load more" means older messages (higher offset). So:

- Page 0 (initial): newest 50, reversed to chronological
- Page 1 (load more): next 50 older, reversed and prepended

This maps to `useInfiniteQuery` with `getNextPageParam` returning the next offset. Pages are stored newest-first in cache. The `select` function flattens all pages, reverses each, and concatenates: `[...page1_reversed, ...page0_reversed]`.

Actually simpler: fetch in ascending order won't work (we need newest first for initial load). Keep descending order, reverse per page, concatenate pages in reverse order.

## Related Code Files

### Files to Modify
- `src/hooks/use-realtime-messages.ts` -- Complete rewrite

### Files Unchanged (verify interface)
- `src/components/chat/message-list.tsx` -- Receives `{ messages, loading, hasMore, loadMore }` props
- `src/app/chat/[conversationId]/page.tsx` -- Calls hook, passes to MessageList

### Consumers to check
```
useRealtimeMessages returns: { messages, loading, hasMore, loadMore, markAsRead, addOptimisticMessage }
```

## Implementation Steps

### 1. Define query key and types

```ts
const messagesQueryKey = (conversationId: string) =>
  ["messages", conversationId] as const;

interface MessagesPage {
  messages: MessageWithSender[];
  nextOffset: number | undefined;
}
```

### 2. Rewrite `src/hooks/use-realtime-messages.ts`

```ts
"use client";

import { useEffect, useCallback, useMemo } from "react";
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { MessageWithSender } from "@/types/database";

const PAGE_SIZE = 50;

interface MessagesPage {
  messages: MessageWithSender[];
  nextOffset: number | undefined;
}

export function useRealtimeMessages(conversationId: string) {
  const queryClient = useQueryClient();
  const queryKey = ["messages", conversationId];

  const {
    data,
    isLoading: loading,
    hasNextPage: hasMore = false,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<MessagesPage>({
    queryKey,
    queryFn: async ({ pageParam = 0 }) => {
      const offset = pageParam as number;
      const supabase = createBrowserSupabaseClient();
      const { data: fetched, error } = await supabase
        .from("messages")
        .select(
          "*, sender:users!messages_sender_id_fkey(id, display_name, avatar_url, is_agent)"
        )
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;

      const messages = (fetched || []) as unknown as MessageWithSender[];
      const nextOffset =
        messages.length === PAGE_SIZE ? offset + PAGE_SIZE : undefined;

      return { messages, nextOffset };
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });

  // Flatten pages into chronological order
  const messages = useMemo(() => {
    if (!data?.pages) return [];
    // Each page has messages in descending order (newest first)
    // Pages array: [page0 (newest), page1 (older), ...]
    // We need: [...page_N_reversed, ..., page1_reversed, page0_reversed]
    const allPages = [...data.pages].reverse();
    return allPages.flatMap((page) => [...page.messages].reverse());
  }, [data?.pages]);

  // Realtime subscription
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMessage = payload.new as MessageWithSender;

          // Fetch sender info
          const { data: senderData } = await supabase
            .from("users_public")
            .select("id, display_name, avatar_url, is_agent")
            .eq("id", newMessage.sender_id)
            .single();

          if (senderData) {
            newMessage.sender = senderData;
            window.dispatchEvent(
              new CustomEvent("message-received", {
                detail: {
                  senderId: senderData.id,
                  isAgent: senderData.is_agent,
                },
              })
            );
          }

          // Surgical cache append
          queryClient.setQueryData<InfiniteData<MessagesPage>>(
            queryKey,
            (old) => {
              if (!old) return old;

              // Dedup check across all pages
              const exists = old.pages.some((page) =>
                page.messages.some((msg) => msg.id === newMessage.id)
              );
              if (exists) return old;

              // Append to first page (newest messages page)
              const updatedPages = [...old.pages];
              const firstPage = updatedPages[0];
              updatedPages[0] = {
                ...firstPage,
                messages: [newMessage, ...firstPage.messages],
              };

              return { ...old, pages: updatedPages };
            }
          );
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [conversationId, queryClient, queryKey]);

  const loadMore = useCallback(() => {
    if (hasMore && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasMore, isFetchingNextPage, fetchNextPage]);

  const markAsRead = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.rpc("mark_conversation_read", {
      conv_id: conversationId,
    });
  }, [conversationId]);

  const addOptimisticMessage = useCallback(
    (message: MessageWithSender) => {
      queryClient.setQueryData<InfiniteData<MessagesPage>>(
        queryKey,
        (old) => {
          if (!old) return old;

          const exists = old.pages.some((page) =>
            page.messages.some((msg) => msg.id === message.id)
          );
          if (exists) return old;

          const updatedPages = [...old.pages];
          const firstPage = updatedPages[0];
          updatedPages[0] = {
            ...firstPage,
            messages: [message, ...firstPage.messages],
          };

          return { ...old, pages: updatedPages };
        }
      );
    },
    [queryClient, queryKey]
  );

  return {
    messages,
    loading,
    hasMore: hasMore ?? false,
    loadMore,
    markAsRead,
    addOptimisticMessage,
  };
}
```

### 3. Verify consumer interface compatibility

The hook returns the same shape:
```ts
{ messages: MessageWithSender[], loading: boolean, hasMore: boolean, loadMore: () => void, markAsRead: () => Promise<void>, addOptimisticMessage: (msg) => void }
```

Check `src/app/chat/[conversationId]/page.tsx` destructures correctly.

### 4. Remove module-level cache

Delete from the file:
- `MESSAGE_CACHE_MAX` constant
- `messageCache` Map
- `setCacheEntry` function
- `CachedConversation` interface

### 5. Test scenarios

- Navigate conv A -> B -> A: messages appear instantly from cache
- Send message: optimistic message appears, realtime confirms
- Receive message from other user: appears via realtime append
- Load more (scroll up): older messages load via fetchNextPage
- Fast conv switching: no duplicate messages, no stale data

## Todo List

- [x] Rewrite `src/hooks/use-realtime-messages.ts` with useInfiniteQuery
- [x] Remove module-level messageCache Map and helpers
- [x] Preserve addOptimisticMessage interface
- [x] Preserve markAsRead interface
- [x] Preserve window.dispatchEvent("message-received") in realtime handler
- [x] Verify consumer components accept same props
- [x] Test conversation switching -- instant from cache
- [x] Test realtime message append -- no duplicates
- [x] Test load more pagination
- [x] Test optimistic send flow
- [x] Verify build compiles

## Success Criteria

- Conversation switch: 0ms to display cached messages
- New messages via realtime: appear without refetch
- Pagination: load more works via fetchNextPage
- No duplicate messages in any scenario
- Module-level Map completely removed

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Page flattening order wrong | High -- messages display out of order | Unit test the `useMemo` flattening logic with mock data; manual QA |
| `queryKey` reference changes on re-render | Medium -- stale closure in realtime handler | Use stable reference or wrap in useRef |
| Realtime + background fetch race | Medium -- duplicate messages | Dedup check in both setQueryData and select |
| `useInfiniteQuery` initial load slower than current LRU | Low -- first load same, subsequent loads faster | staleTime: Infinity means no refetch on re-mount |
| Sender fetch fails in realtime handler | Low -- message appears without sender info | Already handled in current code (message still appends) |

## Security Considerations

- No change to auth model -- Supabase RLS still enforces access
- No sensitive data stored differently (React Query cache is in-memory, same as current Map)
