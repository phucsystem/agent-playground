"use client";

import type { ReactionGroup } from "@/hooks/use-reactions";

interface MessageReactionsProps {
  reactions: ReactionGroup[];
  currentUserId: string;
  onToggle: (emoji: string) => void;
}

export function MessageReactions({
  reactions,
  currentUserId,
  onToggle,
}: MessageReactionsProps) {
  if (reactions.length === 0) return null;

  return (
    <div className="flex gap-1 mt-1 flex-wrap">
      {reactions.map(({ emoji, count, userIds }) => {
        const isMine = userIds.includes(currentUserId);
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition ${
              isMine
                ? "bg-primary-100 border border-primary-300 text-primary-700"
                : "bg-neutral-100 border border-neutral-200 text-neutral-600 hover:border-neutral-300"
            }`}
          >
            <span>{emoji}</span>
            <span className="font-medium">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
