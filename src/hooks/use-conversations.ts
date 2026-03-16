"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ConversationWithDetails } from "@/types/database";

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.rpc("get_my_conversations");

    if (!error && data) {
      setConversations(
        Array.isArray(data) ? data : JSON.parse(data as string)
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConversations();

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("conversation-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          fetchConversations();
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "conversations" },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [fetchConversations]);

  return { conversations, loading, refetch: fetchConversations };
}
