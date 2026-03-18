"use client";

import { useEffect, useCallback, useMemo } from "react";
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { MessageWithSender } from "@/types/database";
import { WORKSPACE_UNREAD_KEY } from "./use-workspace-unread";

const PAGE_SIZE = 50;

interface MessagesPage {
  messages: MessageWithSender[];
  nextOffset: number | undefined;
}

export function useRealtimeMessages(conversationId: string) {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading: loading,
    hasNextPage: hasMore = false,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<MessagesPage>({
    queryKey: ["messages", conversationId],
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
      const nextOffset = messages.length === PAGE_SIZE ? offset + PAGE_SIZE : undefined;

      return { messages, nextOffset };
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });

  // Flatten pages into chronological order
  // Each page has messages in descending order (newest first from DB)
  // Pages: [page0 (newest batch), page1 (older batch), ...]
  // Output: [oldest...newest] for display
  const messages = useMemo(() => {
    if (!data?.pages) return [];
    const allPages = [...data.pages].reverse();
    return allPages.flatMap((page) => [...page.messages].reverse());
  }, [data?.pages]);

  // Realtime subscription — surgical cache append, no refetch
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

          const { data: senderData } = await supabase
            .from("users_public")
            .select("id, display_name, avatar_url, is_agent")
            .eq("id", newMessage.sender_id)
            .single();

          if (!senderData) return;

          newMessage.sender = senderData;
          window.dispatchEvent(
            new CustomEvent("message-received", {
              detail: { senderId: senderData.id, isAgent: senderData.is_agent },
            })
          );

          queryClient.setQueryData<InfiniteData<MessagesPage>>(
            ["messages", conversationId],
            (old) => {
              if (!old) return old;

              const exists = old.pages.some((page) =>
                page.messages.some((msg) => msg.id === newMessage.id)
              );
              if (exists) return old;

              const updatedPages = [...old.pages];
              updatedPages[0] = {
                ...updatedPages[0],
                messages: [newMessage, ...updatedPages[0].messages],
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
  }, [conversationId, queryClient]);

  const loadMore = useCallback(() => {
    if (hasMore && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasMore, isFetchingNextPage, fetchNextPage]);

  const markAsRead = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.rpc("mark_conversation_read", { conv_id: conversationId });
    queryClient.invalidateQueries({ queryKey: WORKSPACE_UNREAD_KEY });
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  }, [conversationId, queryClient]);

  const addOptimisticMessage = useCallback(
    (message: MessageWithSender) => {
      queryClient.setQueryData<InfiniteData<MessagesPage>>(
        ["messages", conversationId],
        (old) => {
          if (!old) return old;

          const exists = old.pages.some((page) =>
            page.messages.some((msg) => msg.id === message.id)
          );
          if (exists) return old;

          const updatedPages = [...old.pages];
          updatedPages[0] = {
            ...updatedPages[0],
            messages: [message, ...updatedPages[0].messages],
          };

          return { ...old, pages: updatedPages };
        }
      );
    },
    [queryClient, conversationId]
  );

  return {
    messages,
    loading,
    hasMore,
    loadMore,
    markAsRead,
    addOptimisticMessage,
  };
}
