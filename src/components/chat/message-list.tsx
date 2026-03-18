"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MessageItem } from "./message-item";
import { ReadReceipts } from "./read-receipts";
import { TypingIndicator } from "./typing-indicator";
import { ArrowDown } from "lucide-react";
import { MessageListSkeleton } from "./message-list-skeleton";
import type { MessageWithSender } from "@/types/database";
import type { ReactionGroup } from "@/hooks/use-reactions";
import type { ReadReceiptUser } from "@/hooks/use-read-receipts";

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
  onStartEdit?: (messageId: string, content: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  canDeleteOthers?: boolean;
  isAdmin?: boolean;
  memberNames?: string[];
  readReceiptsByMessageId?: Map<string, ReadReceiptUser[]>;
  isDm?: boolean;
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
  const meta = message.metadata as Record<string, unknown> | null;
  if (meta?.is_snippet) return 200;

  const content = message.content;
  const codeBlocks = content.match(/```[\s\S]*?```/g) ?? [];
  let codeHeight = 0;
  for (const block of codeBlocks) {
    codeHeight += Math.max(60, block.split("\n").length * 20 + 40);
  }
  const textOnly = content.replace(/```[\s\S]*?```/g, "");
  const wrappedLines = textOnly.split("\n").reduce((sum, line) => {
    return sum + Math.max(1, Math.ceil(line.length / 50));
  }, 0);
  return Math.max(60, codeHeight + wrappedLines * 22 + 48);
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
  onStartEdit,
  onDeleteMessage,
  canDeleteOthers = false,
  isAdmin = false,
  memberNames,
  readReceiptsByMessageId,
  isDm = false,
}: MessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [visible, setVisible] = useState(true);
  const isAtBottomRef = useRef(true);
  const prevMessageCount = useRef(0);
  const prevConversationId = useRef(conversationId);
  const prevTotalSize = useRef(0);
  const isInitialLoad = useRef(true);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => estimateMessageHeight(messages[index]),
    overscan: 15,
    getItemKey: (index) => messages[index].id,
  });

  const scrollToBottom = useCallback((smooth = true) => {
    const container = parentRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    if (prevConversationId.current !== conversationId) {
      prevConversationId.current = conversationId;
      prevMessageCount.current = 0;
      isInitialLoad.current = true;
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
      requestAnimationFrame(() => {
        parentRef.current?.scrollTo({ top: parentRef.current.scrollHeight, behavior: "smooth" });
      });
    }
    prevMessageCount.current = messages.length;
  }, [messages.length, virtualizer]);

  // Re-scroll to bottom when measurement updates change total size during initial load
  useEffect(() => {
    const totalSize = virtualizer.getTotalSize();
    if (
      isInitialLoad.current &&
      prevTotalSize.current > 0 &&
      prevTotalSize.current !== totalSize &&
      isAtBottomRef.current &&
      messages.length > 0
    ) {
      virtualizer.scrollToIndex(messages.length - 1, { align: "end", behavior: "auto" });
    }
    prevTotalSize.current = totalSize;
    if (visible) isInitialLoad.current = false;
  }, [virtualizer.getTotalSize(), visible, messages.length, virtualizer]);

  // Scroll to bottom when typing indicator appears so it's visible
  useEffect(() => {
    if ((agentThinking || typingUsers.length > 0) && isAtBottomRef.current) {
      requestAnimationFrame(() => {
        parentRef.current?.scrollTo({ top: parentRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }, [agentThinking, typingUsers.length]);

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
    return <MessageListSkeleton />;
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      onScroll={handleScroll}
      className={`flex-1 overflow-y-auto pb-8 transition-opacity duration-200 flex flex-col ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <div className="flex-1" />
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
          className="absolute top-0 left-0 w-full px-2 sm:px-4 md:px-6"
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
                  onStartEdit={onStartEdit}
                  onDeleteMessage={onDeleteMessage}
                  canDelete={canDeleteOthers}
                  isAdmin={isAdmin}
                  memberNames={memberNames}
                />
                {readReceiptsByMessageId && (
                  <ReadReceipts
                    readers={readReceiptsByMessageId.get(message.id) || []}
                    isDm={isDm}
                    isCurrentUserMessage={message.sender_id === currentUserId}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-2 sm:px-4 md:px-6">
        <TypingIndicator typingUsers={typingUsers} agentThinking={agentThinking} />
      </div>

      {showScrollDown && (
        <button
          onClick={() => scrollToBottom()}
          className="fixed bottom-20 right-4 md:bottom-24 md:right-8 w-9 h-9 bg-white/90 backdrop-blur-sm border border-neutral-200 rounded-full shadow-lg flex items-center justify-center hover:bg-white hover:scale-105 active:scale-95 transition-all cursor-pointer z-30"
        >
          <ArrowDown className="w-4 h-4 text-neutral-600" />
        </button>
      )}
    </div>
  );
}
