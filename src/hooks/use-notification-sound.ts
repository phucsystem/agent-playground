"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createElement } from "react";
import { MessageToast } from "@/components/ui/message-toast";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { User, ConversationWithDetails } from "@/types/database";

interface IncomingMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  content_type: string;
}

const DEBOUNCE_MS = 3000;
const BROADCAST_CHANNEL_NAME = "notification-sound-leader";
const MAX_HANDLED_IDS = 500;

export function useNotificationSound(
  currentUser: User | null,
  conversations: ConversationWithDetails[]
) {
  const queryClient = useQueryClient();
  const lastSoundTimeRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const handledMessageIds = useRef<Set<string>>(new Set());
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  useEffect(() => {
    audioRef.current = new Audio("/sounds/notification.mp3");
    audioRef.current.volume = 0.5;
    return () => {
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    broadcastRef.current = channel;

    channel.onmessage = (event) => {
      if (event.data?.type === "claimed") {
        handledMessageIds.current.add(event.data.messageId);
      }
    };

    return () => {
      channel.close();
      broadcastRef.current = null;
    };
  }, []);

  const playSound = useCallback(() => {
    const now = Date.now();
    if (now - lastSoundTimeRef.current < DEBOUNCE_MS) return;
    lastSoundTimeRef.current = now;

    audioRef.current?.play().catch(() => {});
  }, []);

  const showNativeNotification = useCallback((title: string, body: string) => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    new Notification(title, {
      body,
      tag: `agent-playground-${Date.now()}`,
    });
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return "denied" as NotificationPermission;
    if (Notification.permission === "granted") return "granted" as NotificationPermission;
    return await Notification.requestPermission();
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;
    if (!currentUser.notification_enabled) return;
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("global-notification-listener")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const message = payload.new as IncomingMessage;

          if (message.sender_id === currentUser.id) return;

          // Skip if user is actively viewing this conversation
          const isViewingConversation = window.location.pathname.endsWith(
            `/chat/${message.conversation_id}`
          );
          if (isViewingConversation) return;

          if (handledMessageIds.current.has(message.id)) return;

          // Look up conversation in current workspace first, then fetch cross-workspace
          let conversation = conversationsRef.current.find(
            (conv) => conv.id === message.conversation_id
          );
          if (!conversation) {
            const { data } = await supabase
              .from("conversations")
              .select("id, type, name, workspace_id")
              .eq("id", message.conversation_id)
              .single();
            if (!data) return;

            // For cross-workspace DMs, fetch the other user info
            let otherUser = null;
            if (data.type === "dm") {
              const { data: members } = await supabase
                .from("conversation_members")
                .select("user_id, users:user_id(display_name, avatar_url)")
                .eq("conversation_id", data.id)
                .neq("user_id", currentUser.id)
                .limit(1);
              const member = members?.[0];
              if (member?.users) {
                const userData = member.users as unknown as { display_name: string; avatar_url: string | null };
                otherUser = { display_name: userData.display_name, avatar_url: userData.avatar_url };
              }
            }

            conversation = {
              ...data,
              other_user: otherUser,
              updated_at: new Date().toISOString(),
            } as ConversationWithDetails;
          }

          const isDm = conversation.type === "dm";
          const hasMention = message.content
            ?.toLowerCase()
            .includes(`@${currentUser.display_name.toLowerCase()}`);

          if (!isDm && !hasMention) return;

          if (broadcastRef.current) {
            broadcastRef.current.postMessage({
              type: "claimed",
              messageId: message.id,
            });
          }
          handledMessageIds.current.add(message.id);
          if (handledMessageIds.current.size > MAX_HANDLED_IDS) {
            const iterator = handledMessageIds.current.values();
            for (let count = 0; count < 100; count++) {
              const oldest = iterator.next().value;
              if (oldest) handledMessageIds.current.delete(oldest);
            }
          }

          const senderName = isDm
            ? conversation.other_user?.display_name || "Someone"
            : conversation.name || "Group";
          const avatarUrl = isDm ? (conversation.other_user?.avatar_url ?? null) : null;
          const preview = message.content?.slice(0, 80) || "New message";

          // Invalidate messages cache so data is fresh when user navigates to this conversation
          queryClient.invalidateQueries({ queryKey: ["messages", message.conversation_id] });

          if (document.hidden || !document.hasFocus()) {
            // Tab not focused (hidden, minimized, or user in another app): play sound + desktop notification
            playSound();
            const title = isDm
              ? `New message from ${senderName}`
              : `Mentioned in ${senderName}`;
            showNativeNotification(title, preview);
          } else {
            // Tab visible but different conversation: show in-app toast
            toast.custom(
              () =>
                createElement(MessageToast, {
                  senderName: isDm ? senderName : (conversation!.other_user?.display_name || senderName),
                  avatarUrl,
                  preview,
                  conversationName: isDm ? undefined : senderName,
                  isGroup: !isDm,
                }),
              { id: `msg-${message.id}`, duration: 4000 }
            );
            playSound();
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentUser?.id, currentUser?.notification_enabled, currentUser?.display_name, playSound, showNativeNotification, queryClient]);

  const triggerTestNotification = useCallback(async (senderName: string) => {
    await requestPermission();
    playSound();
    showNativeNotification(`New message from ${senderName}`, "This is a test notification");
  }, [playSound, showNativeNotification, requestPermission]);

  return { requestPermission, triggerTestNotification };
}
