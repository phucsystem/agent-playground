"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export const WORKSPACE_UNREAD_KEY = ["workspace-unread"];

interface ConversationUnread {
  workspace_id: string;
  unread_count: number;
}

function aggregateUnread(conversations: ConversationUnread[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const conv of conversations) {
    if (!conv.workspace_id) continue;
    const unread = conv.unread_count ?? 0;
    if (unread > 0) {
      counts[conv.workspace_id] = (counts[conv.workspace_id] ?? 0) + unread;
    }
  }
  return counts;
}

export function useWorkspaceUnread(_activeWorkspaceId: string | null) {
  const queryClient = useQueryClient();

  const { data: unreadByWorkspace = {} } = useQuery({
    queryKey: WORKSPACE_UNREAD_KEY,
    queryFn: async () => {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.rpc("get_my_conversations");

      if (error || !data) return {};

      const conversations: ConversationUnread[] = Array.isArray(data)
        ? data
        : JSON.parse(data as string);

      return aggregateUnread(conversations);
    },
    staleTime: 10_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("workspace-unread-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          queryClient.invalidateQueries({ queryKey: WORKSPACE_UNREAD_KEY });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [queryClient]);

  return { unreadByWorkspace };
}
