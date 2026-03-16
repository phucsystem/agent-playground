"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Hash, Archive, Pin } from "lucide-react";
import { CollapsibleSection } from "./collapsible-section";
import { usePinnedConversations } from "@/hooks/use-pinned-conversations";
import type { ConversationWithDetails } from "@/types/database";

interface ConversationListProps {
  conversations: ConversationWithDetails[];
  activeConversationId?: string;
  onlineUserIds: string[];
  currentUserId: string;
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

function getDisplayName(conv: ConversationWithDetails) {
  return conv.type === "dm"
    ? conv.other_user?.display_name || "Unknown"
    : conv.name || "Unnamed Group";
}

function sortWithPins(
  conversations: ConversationWithDetails[],
  pinnedIds: string[]
): ConversationWithDetails[] {
  const pinnedSet = new Set(pinnedIds);
  const pinned = conversations
    .filter((conv) => pinnedSet.has(conv.id))
    .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));
  const unpinned = conversations.filter((conv) => !pinnedSet.has(conv.id));
  return [...pinned, ...unpinned];
}

export function ConversationList({
  conversations,
  activeConversationId,
  onlineUserIds,
  currentUserId,
}: ConversationListProps) {
  const { pinnedIds, togglePin, cleanStalePins } =
    usePinnedConversations(currentUserId);

  const dmConversations = conversations.filter((conv) => conv.type === "dm");
  const activeGroups = conversations.filter(
    (conv) => conv.type === "group" && !conv.is_archived
  );
  const archivedGroups = conversations.filter(
    (conv) => conv.type === "group" && conv.is_archived
  );

  const sortedDMs = sortWithPins(dmConversations, pinnedIds);
  const sortedGroups = sortWithPins(activeGroups, pinnedIds);

  useEffect(() => {
    const nonArchivedIds = conversations
      .filter((conv) => conv.type === "dm" || (conv.type === "group" && !conv.is_archived))
      .map((conv) => conv.id);
    cleanStalePins(nonArchivedIds);
  }, [conversations, cleanStalePins]);

  const pinnedSet = new Set(pinnedIds);

  return (
    <>
      {sortedDMs.length > 0 && (
        <CollapsibleSection title="Direct Messages" count={sortedDMs.length}>
          {sortedDMs.map((conv, index) => {
            const isFirstUnpinned =
              !pinnedSet.has(conv.id) &&
              index > 0 &&
              pinnedSet.has(sortedDMs[index - 1].id);
            return (
              <div key={conv.id}>
                {isFirstUnpinned && (
                  <div className="mx-2 my-1 border-t border-neutral-200" role="separator" />
                )}
                <ConversationItem
                  conversation={conv}
                  isActive={conv.id === activeConversationId}
                  isOnline={
                    conv.other_user
                      ? onlineUserIds.includes(conv.other_user.id)
                      : false
                  }
                  isPinned={pinnedSet.has(conv.id)}
                  onTogglePin={() => togglePin(conv.id)}
                />
              </div>
            );
          })}
        </CollapsibleSection>
      )}

      {sortedGroups.length > 0 && (
        <CollapsibleSection title="Groups" count={sortedGroups.length}>
          {sortedGroups.map((conv, index) => {
            const isFirstUnpinned =
              !pinnedSet.has(conv.id) &&
              index > 0 &&
              pinnedSet.has(sortedGroups[index - 1].id);
            return (
              <div key={conv.id}>
                {isFirstUnpinned && (
                  <div className="mx-2 my-1 border-t border-neutral-200" role="separator" />
                )}
                <ConversationItem
                  conversation={conv}
                  isActive={conv.id === activeConversationId}
                  isOnline={false}
                  isPinned={pinnedSet.has(conv.id)}
                  onTogglePin={() => togglePin(conv.id)}
                />
              </div>
            );
          })}
        </CollapsibleSection>
      )}

      {archivedGroups.length > 0 && (
        <CollapsibleSection
          title="Archived"
          count={archivedGroups.length}
          defaultOpen={false}
        >
          {archivedGroups.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeConversationId}
              isOnline={false}
              isPinned={false}
              onTogglePin={() => {}}
              hidePin
            />
          ))}
        </CollapsibleSection>
      )}
    </>
  );
}

function ConversationItem({
  conversation,
  isActive,
  isOnline,
  isPinned,
  onTogglePin,
  hidePin = false,
}: {
  conversation: ConversationWithDetails;
  isActive: boolean;
  isOnline: boolean;
  isPinned: boolean;
  onTogglePin: () => void;
  hidePin?: boolean;
}) {
  const isDM = conversation.type === "dm";
  const displayName = getDisplayName(conversation);

  return (
    <Link
      href={`/chat/${conversation.id}`}
      className={`group flex items-center gap-2.5 px-2 py-2 rounded-lg transition ${
        isActive
          ? "bg-neutral-200/70 text-primary-500"
          : "hover:bg-neutral-200/50 text-neutral-700"
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
        <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center shrink-0">
          {conversation.is_archived ? (
            <Archive className="w-4 h-4 text-neutral-400" />
          ) : (
            <Hash className="w-4 h-4 text-neutral-500" />
          )}
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

      {!hidePin && (
        <button
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onTogglePin();
          }}
          className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-md transition-all duration-200 ease-out ${
            isPinned
              ? "text-primary-500 bg-primary-50 opacity-100"
              : "text-neutral-400 opacity-0 group-hover:opacity-100 hover:bg-neutral-200/60"
          } hover:text-primary-500`}
          aria-label={isPinned ? "Unpin conversation" : "Pin conversation"}
          aria-pressed={isPinned}
        >
          <Pin
            className={`w-3.5 h-3.5 transition-transform duration-200 ease-out ${
              isPinned ? "-rotate-45" : ""
            }`}
            fill={isPinned ? "currentColor" : "none"}
          />
        </button>
      )}

      {conversation.unread_count > 0 && (
        <span className="shrink-0 min-w-[18px] h-[18px] flex items-center justify-center bg-error text-white text-[10px] font-bold rounded-full px-1">
          {conversation.unread_count}
        </span>
      )}
    </Link>
  );
}
