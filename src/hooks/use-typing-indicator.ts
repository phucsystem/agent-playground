"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

interface TypingUser {
  userId: string;
  displayName: string;
}

const DEBOUNCE_MS = 2000;
const CLEAR_AFTER_MS = 3000;

export function useTypingIndicator(
  conversationId: string,
  currentUserId: string,
  currentDisplayName: string
) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const lastSentRef = useRef(0);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const channelRef = useRef<ReturnType<ReturnType<typeof createBrowserSupabaseClient>["channel"]> | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase.channel(`typing:${conversationId}`);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        const { userId, displayName } = payload.payload as TypingUser;
        if (userId === currentUserId) return;

        setTypingUsers((prev) => {
          const exists = prev.some((typingUser) => typingUser.userId === userId);
          if (!exists) return [...prev, { userId, displayName }];
          return prev;
        });

        const existingTimer = timersRef.current.get(userId);
        if (existingTimer) clearTimeout(existingTimer);

        const timer = setTimeout(() => {
          setTypingUsers((prev) =>
            prev.filter((typingUser) => typingUser.userId !== userId)
          );
          timersRef.current.delete(userId);
        }, CLEAR_AFTER_MS);

        timersRef.current.set(userId, timer);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, [conversationId, currentUserId]);

  const sendTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastSentRef.current < DEBOUNCE_MS) return;
    lastSentRef.current = now;

    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: currentUserId, displayName: currentDisplayName },
    });
  }, [currentUserId, currentDisplayName]);

  return { typingUsers, sendTyping };
}
