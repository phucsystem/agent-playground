"use client";

import { Avatar } from "@/components/ui/avatar";
import { MarkdownContent } from "./markdown-content";
import { FileCard } from "./file-card";
import { ImagePreview } from "./image-preview";
import { UrlPreview } from "./url-preview";
import { SnippetCard } from "./snippet-card";
import { MessageReactions } from "./message-reactions";
import type { MessageWithSender } from "@/types/database";
import { Heart, Pencil, Trash2, MoreHorizontal, Eye, History } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import type { ReactionGroup } from "@/hooks/use-reactions";
import { useTypewriter } from "@/hooks/use-typewriter";
import { useLongPress } from "@/hooks/use-long-press";
import { useSwipeGesture } from "@/hooks/use-swipe-gesture";
import { MobileContextMenu } from "./mobile-context-menu";
import { MessageSquare as ReplyIcon } from "lucide-react";
import { toast } from "sonner";

const MAX_TRACKED_IDS = 500;
const animatedMessageIds = new Set<string>();
const RECENCY_THRESHOLD_MS = 30_000;

function trackAnimatedId(messageId: string) {
  animatedMessageIds.add(messageId);
  if (animatedMessageIds.size > MAX_TRACKED_IDS) {
    const firstId = animatedMessageIds.values().next().value;
    if (firstId) animatedMessageIds.delete(firstId);
  }
}

interface MessageItemProps {
  message: MessageWithSender;
  isGrouped: boolean;
  isCurrentUser: boolean;
  reactions: ReactionGroup[];
  currentUserId: string;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onStartEdit?: (messageId: string, content: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  canDelete?: boolean;
  isAdmin?: boolean;
  memberNames?: string[];
}

function formatTimestamp(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isRecentMessage(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < RECENCY_THRESHOLD_MS;
}

function AgentTextContent({ message, memberNames }: { message: MessageWithSender; memberNames?: string[] }) {
  const shouldAnimateRef = useRef(
    !animatedMessageIds.has(message.id) && isRecentMessage(message.created_at)
  );

  const { displayText, isAnimating, isComplete, skip } = useTypewriter(message.content, {
    enabled: shouldAnimateRef.current,
  });

  useEffect(() => {
    if (isComplete) {
      trackAnimatedId(message.id);
    }
  }, [isComplete, message.id]);

  if (!shouldAnimateRef.current || isComplete) {
    return <MarkdownContent content={message.content} memberNames={memberNames} />;
  }

  return (
    <span className="whitespace-pre-wrap cursor-pointer" onClick={skip} title="Click to reveal full message">
      {displayText}
    </span>
  );
}

function MessageContent({ message, memberNames }: { message: MessageWithSender; memberNames?: string[] }) {
  const meta = message.metadata as Record<string, unknown> | null;

  switch (message.content_type) {
    case "image":
      return (
        <ImagePreview
          src={(meta?.file_url as string) || message.content}
          alt={(meta?.file_name as string) || "Image"}
        />
      );
    case "file":
      return (
        <FileCard
          fileName={(meta?.file_name as string) || message.content}
          fileSize={(meta?.file_size as number) || 0}
          fileType={(meta?.file_type as string) || "application/octet-stream"}
          fileUrl={(meta?.file_url as string) || "#"}
        />
      );
    case "url":
      return (
        <UrlPreview
          url={message.content}
          metadata={meta as { og_title?: string; og_description?: string; og_image?: string; favicon?: string } | null}
        />
      );
    default:
      if (meta?.is_snippet) {
        return (
          <SnippetCard
            title={(meta.snippet_title as string) || "Untitled snippet"}
            content={message.content}
            lineCount={(meta.line_count as number) || message.content.split("\n").length}
          />
        );
      }
      if (message.sender?.is_agent) {
        return <AgentTextContent message={message} memberNames={memberNames} />;
      }
      return <MarkdownContent content={message.content} memberNames={memberNames} />;
  }
}

function HeartButton({
  messageId,
  reactions,
  currentUserId,
  onToggle,
}: {
  messageId: string;
  reactions: ReactionGroup[];
  currentUserId: string;
  onToggle: (messageId: string, emoji: string) => void;
}) {
  const heartReaction = reactions.find((reaction) => reaction.emoji === "❤️");
  const hasHearted = heartReaction?.userIds.includes(currentUserId);
  const heartCount = heartReaction?.count || 0;
  const [animating, setAnimating] = useState(false);

  function handleClick() {
    setAnimating(true);
    onToggle(messageId, "❤️");
    setTimeout(() => setAnimating(false), 300);
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1 self-end -mb-2 px-1.5 py-1 rounded-full transition-all cursor-pointer ${
        heartCount > 0
          ? "text-red-500 !opacity-100"
          : "text-neutral-300 hover:text-red-400 opacity-0 group-hover:opacity-100"
      }`}
    >
      <Heart className={`w-5 h-5 ${heartCount > 0 ? "fill-red-500" : ""} ${animating ? "animate-reaction-pop" : ""}`} />
      {heartCount > 0 && (
        <span className="text-sm font-medium">{heartCount}</span>
      )}
    </button>
  );
}

function isBubblelessMessage(message: MessageWithSender): boolean {
  if (message.is_deleted) return false;
  if (message.content_type === "image" || message.content_type === "file" || message.content_type === "url") return true;
  const meta = message.metadata as Record<string, unknown> | null;
  return !!meta?.is_snippet;
}

function MessageActions({
  message,
  isCurrentUser,
  canDelete,
  onStartEdit,
  onDeleteMessage,
}: {
  message: MessageWithSender;
  isCurrentUser: boolean;
  canDelete: boolean;
  onStartEdit?: (messageId: string, content: string) => void;
  onDeleteMessage?: (messageId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const canEdit = isCurrentUser && message.content_type === "text" && !message.is_deleted;
  const canDeleteMsg = (isCurrentUser || canDelete) && !message.is_deleted;

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!canEdit && !canDeleteMsg) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1 rounded-full text-neutral-300 hover:text-neutral-500 hover:bg-neutral-200/50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className={`absolute ${isCurrentUser ? "right-0" : "left-0"} bottom-full mb-1 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-50 min-w-[120px]`}>
          {canEdit && (
            <button
              onClick={() => { onStartEdit?.(message.id, message.content); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
          {canDeleteMsg && (
            <button
              onClick={() => { onDeleteMessage?.(message.id); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EditedBadge() {
  return <span className="text-[10px] text-neutral-400 italic ml-1">(edited)</span>;
}

function DeletedMessage({ message, isAdmin }: { message?: MessageWithSender; isAdmin?: boolean }) {
  const [showOriginal, setShowOriginal] = useState(false);
  const meta = message?.metadata as Record<string, unknown> | null;
  const originalContent = meta?.original_content as string | undefined;

  return (
    <div>
      <div className="italic text-neutral-400 text-sm py-1 select-none">
        This message was deleted
      </div>
      {isAdmin && originalContent && (
        <div className="mt-1">
          <button
            onClick={() => setShowOriginal(!showOriginal)}
            className="flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700 cursor-pointer"
          >
            <Eye className="w-3 h-3" />
            {showOriginal ? "Hide original" : "View original"}
          </button>
          {showOriginal && (
            <div className="mt-1 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-neutral-600 whitespace-pre-wrap">
              {originalContent}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AdminEditHistory({ message }: { message: MessageWithSender }) {
  const [showHistory, setShowHistory] = useState(false);
  const meta = message.metadata as Record<string, unknown> | null;
  const editHistory = meta?.edit_history as Array<{ content: string; edited_at: string }> | undefined;

  if (!editHistory || editHistory.length === 0) return null;

  return (
    <div className="mt-0.5">
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="flex items-center gap-1 text-[10px] text-amber-600 hover:text-amber-700 cursor-pointer"
      >
        <History className="w-3 h-3" />
        {showHistory ? "Hide history" : `View history (${editHistory.length})`}
      </button>
      {showHistory && (
        <div className="mt-1 space-y-1.5">
          {editHistory.map((entry, entryIndex) => (
            <div key={entryIndex} className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs">
              <div className="text-neutral-400 text-[10px] mb-0.5">
                {new Date(entry.edited_at).toLocaleString()}
              </div>
              <div className="text-neutral-600 whitespace-pre-wrap">{entry.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MessageItem({
  message,
  isGrouped,
  isCurrentUser,
  reactions,
  currentUserId,
  onToggleReaction,
  onStartEdit,
  onDeleteMessage,
  canDelete = false,
  isAdmin = false,
  memberNames,
}: MessageItemProps) {
  const skipBubble = isBubblelessMessage(message);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const canEditMsg = isCurrentUser && message.content_type === "text" && !message.is_deleted;
  const canDeleteMsg = (isCurrentUser || canDelete) && !message.is_deleted;

  const handleLongPress = useCallback((event: React.TouchEvent | React.MouseEvent) => {
    if (message.is_deleted) return;
    const clientX = "touches" in event ? event.touches[0]?.clientX ?? 0 : event.clientX;
    const clientY = "touches" in event ? event.touches[0]?.clientY ?? 0 : event.clientY;
    setContextMenu({ x: clientX, y: clientY });
  }, [message.is_deleted]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content);
    toast.success("Copied to clipboard");
  }, [message.content]);

  const longPressHandlers = useLongPress({
    onLongPress: handleLongPress,
    threshold: 500,
  });

  const { swipeOffset, isSwiping, handlers: swipeHandlers } = useSwipeGesture({
    threshold: 60,
    onSwipeRight: () => {
      // Copy message content as a quick-reply affordance
      navigator.clipboard.writeText(message.content);
      toast.success("Copied — paste to reply");
    },
    enabled: !message.is_deleted,
  });

  const combinedTouchHandlers = {
    onTouchStart: (event: React.TouchEvent) => {
      longPressHandlers.onTouchStart(event);
      swipeHandlers.onTouchStart(event);
    },
    onTouchMove: (event: React.TouchEvent) => {
      longPressHandlers.onTouchMove(event);
      swipeHandlers.onTouchMove(event);
    },
    onTouchEnd: () => {
      longPressHandlers.onTouchEnd();
      swipeHandlers.onTouchEnd();
    },
    onContextMenu: longPressHandlers.onContextMenu,
  };

  if (isCurrentUser) {
    return (
      <div
        className="flex justify-end items-end relative group px-2 py-1"
        {...combinedTouchHandlers}
        style={{ transform: swipeOffset > 0 ? `translateX(${swipeOffset}px)` : undefined, transition: isSwiping ? "none" : "transform 200ms ease-out" }}
      >
        {/* Swipe reply indicator */}
        {swipeOffset > 20 && (
          <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center" style={{ opacity: Math.min(swipeOffset / 60, 1) }}>
            <ReplyIcon className="w-3.5 h-3.5 text-primary-500" />
          </div>
        )}
        <MobileContextMenu
          isOpen={contextMenu !== null}
          position={contextMenu ?? { x: 0, y: 0 }}
          onClose={() => setContextMenu(null)}
          onReaction={(emoji) => onToggleReaction(message.id, emoji)}
          onCopy={handleCopy}
          onEdit={canEditMsg ? () => onStartEdit?.(message.id, message.content) : undefined}
          onDelete={canDeleteMsg ? () => onDeleteMessage?.(message.id) : undefined}
          canEdit={canEditMsg}
          canDelete={canDeleteMsg}
        />
        {!message.is_deleted && (
          <div className="-mr-5 z-10 self-end flex items-center gap-0.5">
            <MessageActions
              message={message}
              isCurrentUser={isCurrentUser}
              canDelete={canDelete}
              onStartEdit={onStartEdit}
              onDeleteMessage={onDeleteMessage}
            />
            <HeartButton
              messageId={message.id}
              reactions={reactions}
              currentUserId={currentUserId}
              onToggle={onToggleReaction}
            />
          </div>
        )}
        <div className="max-w-[85%] md:max-w-[70%]">
          {!isGrouped && (
            <p className="text-[11px] text-neutral-400 text-right mb-0.5 mr-1">
              {formatTimestamp(message.created_at)}
              {message.edited_at && !message.is_deleted && <EditedBadge />}
            </p>
          )}
          {message.is_deleted ? (
            <div className="bg-neutral-50 rounded-2xl rounded-br-sm px-4 py-1.5 border border-neutral-200">
              <DeletedMessage message={message} isAdmin={isAdmin} />
            </div>
          ) : skipBubble ? (
            <div className="flex justify-end">
              <MessageContent message={message} memberNames={memberNames} />
            </div>
          ) : (
            <div className="bg-primary-500 text-white rounded-2xl rounded-br-sm px-4 py-2.5 shadow-sm">
              <div className="text-[15px] leading-relaxed [&_a]:text-white [&_a]:underline [&_pre]:bg-primary-600 [&_pre]:border-primary-400 [&_code]:text-primary-100 [&_.mention-tag]:bg-white/20 [&_.mention-tag]:text-white">
                <MessageContent message={message} memberNames={memberNames} />
              </div>
            </div>
          )}
          {!message.is_deleted && (
            <div className="flex justify-end">
              <MessageReactions
                reactions={reactions.filter((reaction) => reaction.emoji !== "❤️")}
                currentUserId={currentUserId}
                onToggle={(emoji) => onToggleReaction(message.id, emoji)}
              />
            </div>
          )}
          {isAdmin && message.edited_at && !message.is_deleted && (
            <AdminEditHistory message={message} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex gap-2.5 px-2 py-1 relative group"
      {...combinedTouchHandlers}
      style={{ transform: swipeOffset > 0 ? `translateX(${swipeOffset}px)` : undefined, transition: isSwiping ? "none" : "transform 200ms ease-out" }}
    >
      {/* Swipe reply indicator */}
      {swipeOffset > 20 && (
        <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center" style={{ opacity: Math.min(swipeOffset / 60, 1) }}>
          <ReplyIcon className="w-3.5 h-3.5 text-primary-500" />
        </div>
      )}
      <MobileContextMenu
        isOpen={contextMenu !== null}
        position={contextMenu ?? { x: 0, y: 0 }}
        onClose={() => setContextMenu(null)}
        onReaction={(emoji) => onToggleReaction(message.id, emoji)}
        onCopy={handleCopy}
        onEdit={canEditMsg ? () => onStartEdit?.(message.id, message.content) : undefined}
        onDelete={canDeleteMsg ? () => onDeleteMessage?.(message.id) : undefined}
        canEdit={canEditMsg}
        canDelete={canDeleteMsg}
      />
      {!isGrouped ? (
        <Avatar
          displayName={message.sender.display_name}
          avatarUrl={message.sender.avatar_url}
          isAgent={message.sender.is_agent}
          size="sm"
        />
      ) : (
        <div className="w-8 shrink-0" />
      )}

      <div className="max-w-[85%] md:max-w-[70%] min-w-0">
        {!isGrouped && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span
              className={`text-sm font-bold ${
                message.sender.is_agent
                  ? "text-primary-600"
                  : "text-neutral-800"
              }`}
            >
              {message.sender.display_name}
              {message.sender.is_agent && (
                <span className="ml-1 text-[10px] font-semibold text-primary-400 uppercase">[agent]</span>
              )}
            </span>
            <span className="text-[11px] text-neutral-400">
              {formatTimestamp(message.created_at)}
              {message.edited_at && !message.is_deleted && <EditedBadge />}
            </span>
          </div>
        )}
        {message.is_deleted ? (
          <div className="bg-neutral-50 rounded-2xl rounded-bl-sm px-4 py-1.5 border border-neutral-200">
            <DeletedMessage />
          </div>
        ) : skipBubble ? (
          <MessageContent message={message} memberNames={memberNames} />
        ) : (
          <div className="bg-neutral-100 rounded-2xl rounded-bl-sm px-4 py-2.5">
            <div className="text-[15px] leading-relaxed text-neutral-700 [&_.mention-tag]:bg-primary-100 [&_.mention-tag]:text-primary-700">
              <MessageContent message={message} memberNames={memberNames} />
            </div>
          </div>
        )}

        {!message.is_deleted && (
          <MessageReactions
            reactions={reactions.filter((reaction) => reaction.emoji !== "❤️")}
            currentUserId={currentUserId}
            onToggle={(emoji) => onToggleReaction(message.id, emoji)}
          />
        )}
        {isAdmin && message.edited_at && !message.is_deleted && (
          <AdminEditHistory message={message} />
        )}
      </div>

      {!message.is_deleted && (
        <div className="-ml-7 z-10 self-end flex items-center gap-0.5">
          <HeartButton
            messageId={message.id}
            reactions={reactions}
            currentUserId={currentUserId}
            onToggle={onToggleReaction}
          />
          <MessageActions
            message={message}
            isCurrentUser={isCurrentUser}
            canDelete={canDelete}
            onStartEdit={onStartEdit}
            onDeleteMessage={onDeleteMessage}
          />
        </div>
      )}
    </div>
  );
}
