"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Reaction } from "@/types/database";

export interface ReactionGroup {
  emoji: string;
  count: number;
  userIds: string[];
}

export function useReactions(conversationId: string, currentUserId: string) {
  const [reactionsByMessage, setReactionsByMessage] = useState<
    Map<string, Reaction[]>
  >(new Map());

  const fetchReactions = useCallback(async (messageIds: string[]) => {
    if (messageIds.length === 0) return;

    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase
      .from("reactions")
      .select("*")
      .in("message_id", messageIds);

    if (data) {
      const grouped = new Map<string, Reaction[]>();
      for (const reaction of data as Reaction[]) {
        const existing = grouped.get(reaction.message_id) || [];
        existing.push(reaction);
        grouped.set(reaction.message_id, existing);
      }
      setReactionsByMessage(grouped);
    }
  }, []);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`reactions:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reactions" },
        (payload) => {
          const reaction = (payload.new || payload.old) as Reaction;
          if (!reaction?.message_id) return;

          setReactionsByMessage((prev) => {
            const updated = new Map(prev);

            if (payload.eventType === "DELETE") {
              const existing = updated.get(reaction.message_id) || [];
              updated.set(
                reaction.message_id,
                existing.filter((existingReaction) => existingReaction.id !== reaction.id)
              );
            } else {
              const existing = updated.get(reaction.message_id) || [];
              if (!existing.some((existingReaction) => existingReaction.id === reaction.id)) {
                updated.set(reaction.message_id, [...existing, reaction]);
              }
            }

            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [conversationId]);

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const supabase = createBrowserSupabaseClient();
      const existing = reactionsByMessage.get(messageId) || [];
      const myReaction = existing.find(
        (reaction) => reaction.user_id === currentUserId && reaction.emoji === emoji
      );

      if (myReaction) {
        await supabase.from("reactions").delete().eq("id", myReaction.id);
      } else {
        await supabase.from("reactions").insert({
          message_id: messageId,
          user_id: currentUserId,
          emoji,
        });
      }
    },
    [currentUserId, reactionsByMessage]
  );

  function getGroupedReactions(messageId: string): ReactionGroup[] {
    const reactions = reactionsByMessage.get(messageId) || [];
    const groups = new Map<string, string[]>();

    for (const reaction of reactions) {
      const userIds = groups.get(reaction.emoji) || [];
      userIds.push(reaction.user_id);
      groups.set(reaction.emoji, userIds);
    }

    return Array.from(groups.entries()).map(([emoji, userIds]) => ({
      emoji,
      count: userIds.length,
      userIds,
    }));
  }

  return { fetchReactions, toggleReaction, getGroupedReactions };
}
