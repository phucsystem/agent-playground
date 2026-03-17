"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

interface ConversationUnread {
  workspace_id: string;
  unread_count: number;
}

export function useWorkspaceUnread(_activeWorkspaceId: string | null) {
  const [unreadByWorkspace, setUnreadByWorkspace] = useState<Record<string, number>>({});

  const fetchUnread = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.rpc("get_my_conversations");

    if (error || !data) return;

    const conversations: ConversationUnread[] = Array.isArray(data)
      ? data
      : JSON.parse(data as string);

    const counts: Record<string, number> = {};
    for (const conv of conversations) {
      if (!conv.workspace_id) continue;
      const unread = conv.unread_count ?? 0;
      if (unread > 0) {
        counts[conv.workspace_id] = (counts[conv.workspace_id] ?? 0) + unread;
      }
    }
    setUnreadByWorkspace(counts);
  }, []);

  useEffect(() => {
    fetchUnread();

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("workspace-unread-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => fetchUnread()
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [fetchUnread]);

  return { unreadByWorkspace };
}
