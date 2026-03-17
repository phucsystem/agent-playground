"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Hash, Archive, Pin } from "lucide-react";
import { CollapsibleSection } from "./collapsible-section";
import { usePinnedConversations } from "@/hooks/use-pinned-conversations";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import type { ConversationWithDetails } from "@/types/database";
import type { AgentHealthStatus } from "@/hooks/use-agent-health";

interface ConversationListProps {
  conversations: ConversationWithDetails[];
  activeConversationId?: string;
  onlineUserIds: string[];
  currentUserId: string;
  getAgentHealthStatus?: (agentId: string) => AgentHealthStatus;
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
  getAgentHealthStatus,
}: ConversationListProps) {
  const { activeWorkspace } = useWorkspaceContext();
  const { pinnedIds, togglePin, cleanStalePins } =
    usePinnedConversations(currentUserId, activeWorkspace?.id);

  const archivedStorageKey = `show-archived-${currentUserId}-${activeWorkspace?.id ?? "default"}`;
  const [showArchived, setShowArchived] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(archivedStorageKey) === "true";
  });

  const toggleShowArchived = (event: React.MouseEvent) => {
    event.stopPropagation();
    const next = !showArchived;
    setShowArchived(next);
    localStorage.setItem(archivedStorageKey, String(next));
  };

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
                  getAgentHealthStatus={getAgentHealthStatus}
                />
              </div>
            );
          })}
        </CollapsibleSection>
      )}

      {(sortedGroups.length > 0 || archivedGroups.length > 0) && (
        <CollapsibleSection
          title="Groups"
          count={sortedGroups.length}
          action={
            archivedGroups.length > 0 ? (
              <button
                onClick={toggleShowArchived}
                className={`mr-1 p-1 rounded-md transition-colors cursor-pointer ${
                  showArchived
                    ? "text-neutral-500 bg-neutral-100"
                    : "text-neutral-300 hover:text-neutral-500 hover:bg-neutral-100"
                }`}
                aria-label={showArchived ? "Hide archived groups" : "Show archived groups"}
                title={showArchived ? "Hide archived groups" : `Show archived groups (${archivedGroups.length})`}
              >
                <Archive className="w-3 h-3" />
              </button>
            ) : undefined
          }
        >
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

          {showArchived && archivedGroups.length > 0 && (
            <>
              {sortedGroups.length > 0 && (
                <div className="mx-2 my-1 border-t border-neutral-200" role="separator" />
              )}
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
            </>
          )}
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
  getAgentHealthStatus,
}: {
  conversation: ConversationWithDetails;
  isActive: boolean;
  isOnline: boolean;
  isPinned: boolean;
  onTogglePin: () => void;
  hidePin?: boolean;
  getAgentHealthStatus?: (agentId: string) => AgentHealthStatus;
}) {
  const isDM = conversation.type === "dm";
  const displayName = getDisplayName(conversation);

  return (
    <Link
      href={`/chat/${conversation.id}`}
      className={`group flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition cursor-pointer ${
        isActive
          ? "bg-neutral-100 text-primary-600"
          : "hover:bg-neutral-50 text-neutral-700"
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
          healthStatus={
            conversation.other_user.is_agent && getAgentHealthStatus
              ? getAgentHealthStatus(conversation.other_user.id)
              : undefined
          }
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
          {conversation.is_archived ? (
            <Archive className="w-3.5 h-3.5 text-neutral-400" />
          ) : (
            <Hash className="w-3.5 h-3.5 text-neutral-400" />
          )}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-medium truncate leading-tight">{displayName}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {conversation.last_message && (
              <span className="text-[10px] text-neutral-400">
                {formatTime(conversation.last_message.created_at)}
              </span>
            )}
            {conversation.unread_count > 0 && (
              <span className="min-w-[18px] h-[18px] flex items-center justify-center bg-error text-white text-[10px] font-bold rounded-full px-1">
                {conversation.unread_count}
              </span>
            )}
          </div>
        </div>
        {conversation.last_message && (
          <p className="text-[11px] text-neutral-400 truncate mt-0.5 leading-tight">
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
          className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-md transition-all duration-200 ease-out cursor-pointer ${
            isPinned
              ? "text-primary-500 bg-primary-50 opacity-100"
              : "text-neutral-400 opacity-0 group-hover:opacity-100 hover:bg-neutral-100"
          } hover:text-primary-500`}
          aria-label={isPinned ? "Unpin conversation" : "Pin conversation"}
          aria-pressed={isPinned}
        >
          <Pin
            className={`w-3 h-3 transition-transform duration-200 ease-out ${
              isPinned ? "-rotate-45" : ""
            }`}
            fill={isPinned ? "currentColor" : "none"}
          />
        </button>
      )}
    </Link>
  );
}
