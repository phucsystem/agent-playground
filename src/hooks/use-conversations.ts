"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ConversationWithDetails } from "@/types/database";

export function useConversations(workspaceId: string | null) {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const initialFetchDone = useRef(false);

  const fetchConversations = useCallback(async () => {
    if (!workspaceId) return;

    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.rpc("get_my_conversations", {
      ws_id: workspaceId,
    });

    if (!error && data) {
      setConversations(
        Array.isArray(data) ? data : JSON.parse(data as string)
      );
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    // Reset state immediately on workspace change to prevent stale data
    setConversations([]);
    setLoading(true);
    initialFetchDone.current = false;

    if (!workspaceId) return;

    fetchConversations().then(() => {
      initialFetchDone.current = true;
    });

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`conversation-updates-${workspaceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          fetchConversations();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations", filter: `workspace_id=eq.${workspaceId}` },
        () => {
          fetchConversations();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations", filter: `workspace_id=eq.${workspaceId}` },
        () => {
          fetchConversations();
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "conversations", filter: `workspace_id=eq.${workspaceId}` },
        () => {
          fetchConversations();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_members" },
        () => {
          fetchConversations();
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "conversation_members" },
        () => {
          fetchConversations();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && initialFetchDone.current) {
          fetchConversations();
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [fetchConversations, workspaceId]);

  return { conversations, loading, refetch: fetchConversations };
}
