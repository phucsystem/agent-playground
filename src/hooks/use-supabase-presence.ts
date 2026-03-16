"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { User } from "@/types/database";

export interface OnlineUser {
  user_id: string;
  display_name: string;
  is_agent: boolean;
  avatar_url: string | null;
}

export function useSupabasePresence(currentUser: User | null) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [newlyOnlineUsers, setNewlyOnlineUsers] = useState<OnlineUser[]>([]);
  const channelRef = useRef<ReturnType<ReturnType<typeof createBrowserSupabaseClient>["channel"]> | null>(null);
  const previousIdsRef = useRef<Set<string>>(new Set());
  const isInitialSyncRef = useRef(true);
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const userId = currentUser?.id;

  useEffect(() => {
    if (!userId || !currentUserRef.current) return;

    isInitialSyncRef.current = true;
    previousIdsRef.current = new Set();

    const userSnapshot = currentUserRef.current;
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

        const currentIds = new Set(users.map((user) => user.user_id));

        if (isInitialSyncRef.current) {
          isInitialSyncRef.current = false;
          previousIdsRef.current = currentIds;
          return;
        }

        const newArrivals = users.filter(
          (user) =>
            !previousIdsRef.current.has(user.user_id) &&
            !user.is_agent &&
            user.user_id !== userId
        );

        if (newArrivals.length > 0) {
          setNewlyOnlineUsers((prev) => [...prev, ...newArrivals]);
        }

        previousIdsRef.current = currentIds;
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: userSnapshot.id,
            display_name: userSnapshot.display_name,
            is_agent: userSnapshot.is_agent,
            avatar_url: userSnapshot.avatar_url,
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [userId]);

  const clearNewlyOnline = useCallback(() => {
    setNewlyOnlineUsers([]);
  }, []);

  const markUserOnline = useCallback((targetUserId: string) => {
    setOnlineUsers((prev) => {
      if (prev.some((user) => user.user_id === targetUserId)) return prev;
      return [...prev, { user_id: targetUserId, display_name: "User", is_agent: false, avatar_url: null }];
    });
  }, []);

  return { onlineUsers, newlyOnlineUsers, clearNewlyOnline, markUserOnline };
}
