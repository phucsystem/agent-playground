"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { User, MemberRole } from "@/types/database";

interface MemberWithUser {
  conversation_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
  user: Pick<User, "id" | "display_name" | "avatar_url" | "is_agent">;
}

export function useConversationMembers(conversationId: string | null) {
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    if (!conversationId) return;

    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase
      .from("conversation_members")
      .select("*, user:users!conversation_members_user_id_fkey(id, display_name, avatar_url, is_agent)")
      .eq("conversation_id", conversationId);

    if (data) {
      setMembers(data as unknown as MemberWithUser[]);
    }
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return { members, loading, refetch: fetchMembers };
}
