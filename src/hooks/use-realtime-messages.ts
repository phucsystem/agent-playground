"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { MessageWithSender } from "@/types/database";

const PAGE_SIZE = 50;

interface CachedConversation {
  messages: MessageWithSender[];
  hasMore: boolean;
  offset: number;
}

const messageCache = new Map<string, CachedConversation>();

export function useRealtimeMessages(conversationId: string) {
  const cached = messageCache.get(conversationId);
  const [messages, setMessages] = useState<MessageWithSender[]>(cached?.messages || []);
  const [loading, setLoading] = useState(!cached);
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? true);
  const offsetRef = useRef(cached?.offset ?? 0);

  const updateCache = useCallback((msgs: MessageWithSender[], more: boolean, offset: number) => {
    messageCache.set(conversationId, { messages: msgs, hasMore: more, offset });
  }, [conversationId]);

  const fetchMessages = useCallback(async (offset = 0) => {
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase
      .from("messages")
      .select("*, sender:users!messages_sender_id_fkey(id, display_name, avatar_url, is_agent)")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      setLoading(false);
      return;
    }

    const fetched = (data || []) as unknown as MessageWithSender[];
    const more = fetched.length === PAGE_SIZE;
    const newOffset = offset + fetched.length;

    if (offset === 0) {
      const reversed = fetched.reverse();
      setMessages(reversed);
      updateCache(reversed, more, newOffset);
    } else {
      setMessages((prev) => {
        const merged = [...fetched.reverse(), ...prev];
        updateCache(merged, more, newOffset);
        return merged;
      });
    }

    setHasMore(more);
    offsetRef.current = newOffset;
    setLoading(false);
  }, [conversationId, updateCache]);

  const loadMore = useCallback(() => {
    if (hasMore) {
      fetchMessages(offsetRef.current);
    }
  }, [hasMore, fetchMessages]);

  useEffect(() => {
    const existing = messageCache.get(conversationId);
    if (existing) {
      setMessages(existing.messages);
      setHasMore(existing.hasMore);
      offsetRef.current = existing.offset;
      setLoading(false);
    } else {
      setMessages([]);
      setLoading(true);
      offsetRef.current = 0;
    }
    fetchMessages(0);

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

          if (senderData) {
            newMessage.sender = senderData;
          }

          setMessages((prev) => {
            if (prev.some((msg) => msg.id === newMessage.id)) return prev;
            const updated = [...prev, newMessage];
            const cachedData = messageCache.get(conversationId);
            if (cachedData) {
              messageCache.set(conversationId, { ...cachedData, messages: updated });
            }
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [conversationId, fetchMessages]);

  const markAsRead = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.rpc("mark_conversation_read", { conv_id: conversationId });
  }, [conversationId]);

  return { messages, loading, hasMore, loadMore, markAsRead };
}
