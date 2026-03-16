"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

interface MemberWithUser {
  conversation_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  user: { id: string; display_name: string; avatar_url: string | null; is_agent: boolean };
}

interface RpcMemberRow {
  conversation_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  display_name: string;
  avatar_url: string | null;
  is_agent: boolean;
}

export function useConversationMembers(conversationId: string | null) {
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    if (!conversationId) return;

    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.rpc("get_conversation_members", {
      target_conversation_id: conversationId,
    });

    if (data) {
      const mapped = (data as RpcMemberRow[]).map((row) => ({
        conversation_id: row.conversation_id,
        user_id: row.user_id,
        role: row.role,
        joined_at: row.joined_at,
        user: {
          id: row.user_id,
          display_name: row.display_name,
          avatar_url: row.avatar_url,
          is_agent: row.is_agent,
        },
      }));
      setMembers(mapped);
    }
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return { members, loading, refetch: fetchMembers };
}
