"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
  agentThinking?: boolean;
  getGroupedReactions: (messageId: string) => ReactionGroup[];
  onToggleReaction: (messageId: string, emoji: string) => void;
  memberNames?: string[];
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

function estimateMessageHeight(message: MessageWithSender): number {
  if (message.content_type === "image") return 260;
  if (message.content_type === "file") return 80;
  if (message.content_type === "url") return 120;
  const lineCount = Math.ceil(message.content.length / 60);
  return Math.max(60, lineCount * 24 + 48);
}

export function MessageList({
  messages,
  loading,
  hasMore,
  loadMore,
  currentUserId,
  conversationId,
  typingUsers,
  agentThinking,
  getGroupedReactions,
  onToggleReaction,
  memberNames,
}: MessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [visible, setVisible] = useState(true);
  const isAtBottomRef = useRef(true);
  const prevMessageCount = useRef(0);
  const prevConversationId = useRef(conversationId);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => estimateMessageHeight(messages[index]),
    overscan: 15,
    getItemKey: (index) => messages[index].id,
  });

  const scrollToBottom = useCallback((smooth = true) => {
    if (messages.length === 0) return;
    virtualizer.scrollToIndex(messages.length - 1, {
      align: "end",
      behavior: smooth ? "smooth" : "auto",
    });
  }, [virtualizer, messages.length]);

  useEffect(() => {
    if (prevConversationId.current !== conversationId) {
      prevConversationId.current = conversationId;
      prevMessageCount.current = 0;
      setVisible(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (messages.length === 0) return;

    if (prevMessageCount.current === 0) {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(messages.length - 1, {
          align: "end",
          behavior: "auto",
        });
        requestAnimationFrame(() => setVisible(true));
      });
      prevMessageCount.current = messages.length;
      return;
    }

    if (messages.length > prevMessageCount.current && isAtBottomRef.current) {
      virtualizer.scrollToIndex(messages.length - 1, {
        align: "end",
        behavior: "smooth",
      });
    }
    prevMessageCount.current = messages.length;
  }, [messages.length, virtualizer]);

  function handleScroll() {
    const container = parentRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    isAtBottomRef.current = distanceFromBottom < 100;
    setShowScrollDown(distanceFromBottom > 300);

    if (container.scrollTop < 200 && hasMore && !loading) {
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

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      onScroll={handleScroll}
      className={`flex-1 overflow-y-auto transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
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

        <div
          className="absolute top-0 left-0 w-full px-6"
          style={{
            transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
          }}
        >
          {virtualItems.map((virtualRow) => {
            const message = messages[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className="py-0.5"
              >
                <MessageItem
                  message={message}
                  isGrouped={shouldGroup(message, messages[virtualRow.index - 1])}
                  isCurrentUser={message.sender_id === currentUserId}
                  reactions={getGroupedReactions(message.id)}
                  currentUserId={currentUserId}
                  onToggleReaction={onToggleReaction}
                  memberNames={memberNames}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-6">
        <TypingIndicator typingUsers={typingUsers} agentThinking={agentThinking} />
      </div>

      {showScrollDown && (
        <button
          onClick={() => scrollToBottom()}
          className="fixed bottom-24 right-8 w-10 h-10 bg-white border border-neutral-200 rounded-full shadow-md flex items-center justify-center hover:bg-neutral-50 transition cursor-pointer"
        >
          <ArrowDown className="w-4 h-4 text-neutral-600" />
        </button>
      )}
    </div>
  );
}
