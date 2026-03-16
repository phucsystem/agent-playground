"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { MessageWithSender } from "@/types/database";

const PAGE_SIZE = 50;

export function useRealtimeMessages(conversationId: string) {
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

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

    if (offset === 0) {
      setMessages(fetched.reverse());
    } else {
      setMessages((prev) => [...fetched.reverse(), ...prev]);
    }

    setHasMore(fetched.length === PAGE_SIZE);
    offsetRef.current = offset + fetched.length;
    setLoading(false);
  }, [conversationId]);

  const loadMore = useCallback(() => {
    if (hasMore) {
      fetchMessages(offsetRef.current);
    }
  }, [hasMore, fetchMessages]);

  useEffect(() => {
    offsetRef.current = 0;
    setMessages([]);
    setLoading(true);
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
            return [...prev, newMessage];
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
