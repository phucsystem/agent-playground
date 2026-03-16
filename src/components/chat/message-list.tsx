"use client";

import { useEffect, useRef, useState } from "react";
import { MessageItem } from "./message-item";
import { TypingIndicator } from "./typing-indicator";
import { Loader2, ArrowDown } from "lucide-react";
import type { MessageWithSender } from "@/types/database";
import type { ReactionGroup } from "@/hooks/use-reactions";

interface MessageListProps {
  messages: MessageWithSender[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  currentUserId: string;
  conversationId: string;
  typingUsers: { userId: string; displayName: string }[];
  getGroupedReactions: (messageId: string) => ReactionGroup[];
  onToggleReaction: (messageId: string, emoji: string) => void;
}

function shouldGroup(
  current: MessageWithSender,
  previous: MessageWithSender | undefined
) {
  if (!previous) return false;
  if (current.sender_id !== previous.sender_id) return false;
  const diffMs =
    new Date(current.created_at).getTime() -
    new Date(previous.created_at).getTime();
  return diffMs < 300000;
}

export function MessageList({
  messages,
  loading,
  hasMore,
  loadMore,
  currentUserId,
  conversationId,
  typingUsers,
  getGroupedReactions,
  onToggleReaction,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const prevMessageCount = useRef(0);
  const isAtBottomRef = useRef(true);

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    prevMessageCount.current = 0;
  }, [conversationId]);

  useEffect(() => {
    if (messages.length > 0 && prevMessageCount.current === 0) {
      const scrollToEnd = () => bottomRef.current?.scrollIntoView();
      requestAnimationFrame(scrollToEnd);
      const delayedScroll = setTimeout(scrollToEnd, 500);
      prevMessageCount.current = messages.length;
      return () => clearTimeout(delayedScroll);
    }
    if (messages.length > prevMessageCount.current && isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCount.current = messages.length;
  }, [messages.length]);

  function handleScroll() {
    const container = containerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    isAtBottomRef.current = distanceFromBottom < 100;
    setShowScrollDown(distanceFromBottom > 300);

    if (container.scrollTop < 100 && hasMore && !loading) {
      loadMore();
    }
  }

  if (loading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-6 py-4"
    >
      {hasMore && (
        <div className="flex justify-center py-2">
          <button
            onClick={loadMore}
            className="text-xs text-primary-500 hover:underline"
          >
            Load older messages
          </button>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {messages.map((message, messageIndex) => (
          <MessageItem
            key={message.id}
            message={message}
            isGrouped={shouldGroup(message, messages[messageIndex - 1])}
            isCurrentUser={message.sender_id === currentUserId}
            reactions={getGroupedReactions(message.id)}
            currentUserId={currentUserId}
            onToggleReaction={onToggleReaction}
          />
        ))}
      </div>

      <TypingIndicator typingUsers={typingUsers} />

      <div ref={bottomRef} />

      {showScrollDown && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-24 right-8 w-10 h-10 bg-white border border-neutral-200 rounded-full shadow-md flex items-center justify-center hover:bg-neutral-50 transition"
        >
          <ArrowDown className="w-4 h-4 text-neutral-600" />
        </button>
      )}
    </div>
  );
}
