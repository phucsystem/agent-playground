"use client";

import { Avatar } from "@/components/ui/avatar";
import { MarkdownContent } from "./markdown-content";
import { FileCard } from "./file-card";
import { ImagePreview } from "./image-preview";
import { UrlPreview } from "./url-preview";
import { MessageReactions } from "./message-reactions";
import type { MessageWithSender } from "@/types/database";
import { Heart, Sparkles } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import type { ReactionGroup } from "@/hooks/use-reactions";
import { useTypewriter } from "@/hooks/use-typewriter";

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
        hasHearted
          ? "text-red-500"
          : "text-neutral-300 hover:text-red-400 opacity-0 group-hover:opacity-100"
      } ${heartCount > 0 ? "!opacity-100" : ""}`}
    >
      <Heart className={`w-5 h-5 ${hasHearted ? "fill-red-500" : ""} ${animating ? "animate-reaction-pop" : ""}`} />
      {heartCount > 0 && (
        <span className="text-sm font-medium">{heartCount}</span>
      )}
    </button>
  );
}

function isImageMessage(message: MessageWithSender): boolean {
  return message.content_type === "image";
}

export function MessageItem({
  message,
  isGrouped,
  isCurrentUser,
  reactions,
  currentUserId,
  onToggleReaction,
  memberNames,
}: MessageItemProps) {
  const isImage = isImageMessage(message);

  if (isCurrentUser) {
    return (
      <div className="flex justify-end items-end relative group px-2 py-1">
        <div className="-mr-5 z-10 self-end">
          <HeartButton
            messageId={message.id}
            reactions={reactions}
            currentUserId={currentUserId}
            onToggle={onToggleReaction}
          />
        </div>
        <div className="max-w-[85%] md:max-w-[70%]">
          {!isGrouped && (
            <p className="text-[11px] text-neutral-400 text-right mb-0.5 mr-1">
              {formatTimestamp(message.created_at)}
            </p>
          )}
          {isImage ? (
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
          <div className="flex justify-end">
            <MessageReactions
              reactions={reactions.filter((reaction) => reaction.emoji !== "❤️")}
              currentUserId={currentUserId}
              onToggle={(emoji) => onToggleReaction(message.id, emoji)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 px-2 py-1 relative group">
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
                <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-primary-50 text-primary-600 text-[10px] font-semibold uppercase rounded-full border border-primary-200">
                  <Sparkles className="w-2.5 h-2.5" />
                  AI
                </span>
              )}
            </span>
            <span className="text-[11px] text-neutral-400">
              {formatTimestamp(message.created_at)}
            </span>
          </div>
        )}
        {isImage ? (
          <MessageContent message={message} memberNames={memberNames} />
        ) : (
          <div className={`rounded-2xl rounded-bl-sm px-4 py-2.5 ${
            message.sender?.is_agent
              ? "bg-gradient-to-br from-primary-50 via-white to-violet-50 border border-primary-100 border-l-[3px] border-l-primary-400 shadow-sm shadow-primary-100/50"
              : "bg-neutral-100"
          }`}>
            <div className={`text-[15px] leading-relaxed ${
              message.sender?.is_agent
                ? "text-neutral-700 [&_.mention-tag]:bg-primary-100 [&_.mention-tag]:text-primary-700 [&_pre]:bg-neutral-900 [&_pre]:border-primary-400 [&_pre_code]:text-primary-200 [&_a]:text-primary-600 [&_a]:font-medium"
                : "text-neutral-700 [&_.mention-tag]:bg-primary-100 [&_.mention-tag]:text-primary-700"
            }`}>
              <MessageContent message={message} memberNames={memberNames} />
            </div>
          </div>
        )}

        <MessageReactions
          reactions={reactions.filter((reaction) => reaction.emoji !== "❤️")}
          currentUserId={currentUserId}
          onToggle={(emoji) => onToggleReaction(message.id, emoji)}
        />
      </div>

      <div className="-ml-7 z-10 self-end">
        <HeartButton
          messageId={message.id}
          reactions={reactions}
          currentUserId={currentUserId}
          onToggle={onToggleReaction}
        />
      </div>
    </div>
  );
}
