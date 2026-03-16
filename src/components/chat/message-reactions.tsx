"use client";

import { useState } from "react";
import type { ReactionGroup } from "@/hooks/use-reactions";

interface MessageReactionsProps {
  reactions: ReactionGroup[];
  currentUserId: string;
  onToggle: (emoji: string) => void;
}

function ReactionButton({
  emoji,
  count,
  isMine,
  onToggle,
}: {
  emoji: string;
  count: number;
  isMine: boolean;
  onToggle: (emoji: string) => void;
}) {
  const [animating, setAnimating] = useState(false);

  function handleClick() {
    setAnimating(true);
    onToggle(emoji);
    setTimeout(() => setAnimating(false), 300);
  }

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition cursor-pointer ${
        isMine
          ? "bg-primary-100 border border-primary-300 text-primary-700"
          : "bg-neutral-100 border border-neutral-200 text-neutral-600 hover:border-neutral-300"
      } ${animating ? "animate-reaction-pop" : ""}`}
    >
      <span>{emoji}</span>
      <span className="font-medium">{count}</span>
    </button>
  );
}

export function MessageReactions({
  reactions,
  currentUserId,
  onToggle,
}: MessageReactionsProps) {
  if (reactions.length === 0) return null;

  return (
    <div className="flex gap-1 mt-1 flex-wrap">
      {reactions.map(({ emoji, count, userIds }) => (
        <ReactionButton
          key={emoji}
          emoji={emoji}
          count={count}
          isMine={userIds.includes(currentUserId)}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
