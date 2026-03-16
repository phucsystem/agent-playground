"use client";

import { useEffect, useState, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { User } from "@/types/database";

interface OnlineUser {
  user_id: string;
  display_name: string;
  is_agent: boolean;
  avatar_url: string | null;
}

export function useSupabasePresence(currentUser: User | null) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const channelRef = useRef<ReturnType<ReturnType<typeof createBrowserSupabaseClient>["channel"]> | null>(null);

  useEffect(() => {
    if (!currentUser) return;

    const supabase = createBrowserSupabaseClient();
    const channel = supabase.channel("online-users");
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<OnlineUser>();
        const users: OnlineUser[] = [];
        const seen = new Set<string>();

        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            if (!seen.has(presence.user_id)) {
              seen.add(presence.user_id);
              users.push({
                user_id: presence.user_id,
                display_name: presence.display_name,
                is_agent: presence.is_agent,
                avatar_url: presence.avatar_url,
              });
            }
          });
        });

        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: currentUser.id,
            display_name: currentUser.display_name,
            is_agent: currentUser.is_agent,
            avatar_url: currentUser.avatar_url,
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [currentUser]);

  return { onlineUsers };
}
