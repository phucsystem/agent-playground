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

  useEffect(() => {
    if (!workspaceId) return;

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`conversation-updates-${workspaceId}`)
      .on(
        "postgres_changes",
        // No workspace_id filter available on messages table directly (it's on conversations join).
        // Supabase RLS limits events to messages the user can access, so cross-workspace noise is minimal.
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conversations", workspaceId] });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations", filter: `workspace_id=eq.${workspaceId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conversations", workspaceId] });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations", filter: `workspace_id=eq.${workspaceId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conversations", workspaceId] });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "conversations", filter: `workspace_id=eq.${workspaceId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conversations", workspaceId] });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_members" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conversations", workspaceId] });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "conversation_members" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conversations", workspaceId] });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [workspaceId, queryClient]);

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["conversations", workspaceId] });
  };

  return { conversations, loading, refetch };
}
