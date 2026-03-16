"use client";

import { Avatar } from "@/components/ui/avatar";
import { MarkdownContent } from "./markdown-content";
import { FileCard } from "./file-card";
import { ImagePreview } from "./image-preview";
import { UrlPreview } from "./url-preview";
import type { MessageWithSender } from "@/types/database";

interface MessageItemProps {
  message: MessageWithSender;
  isGrouped: boolean;
  isCurrentUser: boolean;
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

function MessageContent({ message }: { message: MessageWithSender }) {
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
      return <MarkdownContent content={message.content} />;
  }
}

export function MessageItem({
  message,
  isGrouped,
  isCurrentUser,
}: MessageItemProps) {
  if (isCurrentUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[70%]">
          {!isGrouped && (
            <p className="text-[11px] text-neutral-400 text-right mb-0.5 mr-1">
              {formatTimestamp(message.created_at)}
            </p>
          )}
          <div className="bg-neutral-100 rounded-2xl rounded-br-md px-4 py-2.5">
            <MessageContent message={message} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5">
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

      <div className="flex-1 min-w-0">
        {!isGrouped && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span
              className={`text-sm font-semibold ${
                message.sender.is_agent
                  ? "text-primary-600"
                  : "text-neutral-800"
              }`}
            >
              {message.sender.display_name}
            </span>
            <span className="text-[11px] text-neutral-400">
              {formatTimestamp(message.created_at)}
            </span>
          </div>
        )}
        <MessageContent message={message} />
      </div>
    </div>
  );
}
