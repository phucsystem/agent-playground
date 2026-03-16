"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Hash, Users } from "lucide-react";
import type { ConversationWithDetails } from "@/types/database";

interface ConversationListProps {
  conversations: ConversationWithDetails[];
  activeConversationId?: string;
  onlineUserIds: string[];
}

function formatTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffMin < 1440) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function ConversationList({
  conversations,
  activeConversationId,
  onlineUserIds,
}: ConversationListProps) {
  const dmConversations = conversations.filter((conv) => conv.type === "dm");
  const groupConversations = conversations.filter((conv) => conv.type === "group");

  return (
    <div className="px-3 py-2">
      {dmConversations.length > 0 && (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 px-2 mb-1">
            Direct Messages
          </p>
          {dmConversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeConversationId}
              isOnline={conv.other_user ? onlineUserIds.includes(conv.other_user.id) : false}
            />
          ))}
        </>
      )}

      {groupConversations.length > 0 && (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 px-2 mb-1 mt-3">
            Groups
          </p>
          {groupConversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeConversationId}
              isOnline={false}
            />
          ))}
        </>
      )}
    </div>
  );
}

function ConversationItem({
  conversation,
  isActive,
  isOnline,
}: {
  conversation: ConversationWithDetails;
  isActive: boolean;
  isOnline: boolean;
}) {
  const isDM = conversation.type === "dm";
  const displayName = isDM
    ? conversation.other_user?.display_name || "Unknown"
    : conversation.name || "Unnamed Group";

  return (
    <Link
      href={`/chat/${conversation.id}`}
      className={`flex items-center gap-2.5 px-2 py-2 rounded-lg transition ${
        isActive
          ? "bg-neutral-100 text-primary-500"
          : "hover:bg-neutral-100 text-neutral-700"
      }`}
    >
      {isDM && conversation.other_user ? (
        <Avatar
          displayName={conversation.other_user.display_name}
          avatarUrl={conversation.other_user.avatar_url}
          isAgent={conversation.other_user.is_agent}
          size="sm"
          showPresence
          isOnline={isOnline}
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center">
          <Hash className="w-4 h-4 text-neutral-500" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium truncate">{displayName}</span>
          {conversation.last_message && (
            <span className="text-[10px] text-neutral-400 shrink-0 ml-1">
              {formatTime(conversation.last_message.created_at)}
            </span>
          )}
        </div>
        {conversation.last_message && (
          <p className="text-xs text-neutral-400 truncate">
            {truncate(conversation.last_message.content, 40)}
          </p>
        )}
      </div>

      {conversation.unread_count > 0 && (
        <span className="shrink-0 min-w-[18px] h-[18px] flex items-center justify-center bg-error text-white text-[10px] font-bold rounded-full px-1">
          {conversation.unread_count}
        </span>
      )}
    </Link>
  );
}
