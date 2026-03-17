"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Hash, Archive, Pin, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CollapsibleSection } from "./collapsible-section";
import { usePinnedConversations } from "@/hooks/use-pinned-conversations";
import { useConversationOrder } from "@/hooks/use-conversation-order";
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

function sortWithPinsAndOrder(
  conversations: ConversationWithDetails[],
  pinnedIds: string[],
  orderedIds: string[]
): { pinned: ConversationWithDetails[]; unpinned: ConversationWithDetails[] } {
  const pinnedSet = new Set(pinnedIds);
  const orderMap = new Map(orderedIds.map((id, index) => [id, index]));

  const pinned = conversations
    .filter((conv) => pinnedSet.has(conv.id))
    .sort((convA, convB) => getDisplayName(convA).localeCompare(getDisplayName(convB)));

  const unpinned = conversations
    .filter((conv) => !pinnedSet.has(conv.id))
    .sort((convA, convB) => {
      const orderA = orderMap.get(convA.id) ?? Infinity;
      const orderB = orderMap.get(convB.id) ?? Infinity;
      return orderA - orderB;
    });

  return { pinned, unpinned };
}

interface SortableSectionProps {
  pinned: ConversationWithDetails[];
  unpinned: ConversationWithDetails[];
  activeConversationId?: string;
  onlineUserIds: string[];
  pinnedSet: Set<string>;
  onTogglePin: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  getAgentHealthStatus?: (agentId: string) => AgentHealthStatus;
}

function SortableSection({
  pinned,
  unpinned,
  activeConversationId,
  onlineUserIds,
  pinnedSet,
  onTogglePin,
  onReorder,
  getAgentHealthStatus,
}: SortableSectionProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fromIndex = unpinned.findIndex((conv) => conv.id === active.id);
    const toIndex = unpinned.findIndex((conv) => conv.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      onReorder(fromIndex, toIndex);
    }
  }

  return (
    <>
      {pinned.map((conv, index) => (
        <div key={conv.id}>
          {index === 0 && unpinned.length > 0 && (
            <div className="mx-2 my-1 border-t border-neutral-200" role="separator" />
          )}
          <ConversationItem
            conversation={conv}
            isActive={conv.id === activeConversationId}
            isOnline={conv.other_user ? onlineUserIds.includes(conv.other_user.id) : false}
            isPinned={true}
            onTogglePin={() => onTogglePin(conv.id)}
            isDraggable={false}
            getAgentHealthStatus={getAgentHealthStatus}
          />
        </div>
      ))}

      {pinned.length > 0 && unpinned.length > 0 && (
        <div className="mx-2 my-1 border-t border-neutral-200" role="separator" />
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={unpinned.map((conv) => conv.id)}
          strategy={verticalListSortingStrategy}
        >
          {unpinned.map((conv) => (
            <SortableConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeConversationId}
              isOnline={conv.other_user ? onlineUserIds.includes(conv.other_user.id) : false}
              isPinned={pinnedSet.has(conv.id)}
              onTogglePin={() => onTogglePin(conv.id)}
              getAgentHealthStatus={getAgentHealthStatus}
            />
          ))}
        </SortableContext>
      </DndContext>
    </>
  );
}

export function ConversationList({
  conversations,
  activeConversationId,
  onlineUserIds,
  currentUserId,
  getAgentHealthStatus,
}: ConversationListProps) {
  const { activeWorkspace } = useWorkspaceContext();
  const workspaceId = activeWorkspace?.id ?? "";

  const { pinnedIds, togglePin, cleanStalePins } = usePinnedConversations(
    currentUserId,
    workspaceId
  );

  const dmOrder = useConversationOrder(currentUserId, workspaceId, "dm");
  const groupOrder = useConversationOrder(currentUserId, workspaceId, "group");

  const archivedStorageKey = `show-archived-${currentUserId}-${workspaceId || "default"}`;
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

  const { pinned: pinnedDMs, unpinned: unpinnedDMs } = sortWithPinsAndOrder(
    dmConversations,
    pinnedIds,
    dmOrder.orderedIds
  );
  const { pinned: pinnedGroups, unpinned: unpinnedGroups } = sortWithPinsAndOrder(
    activeGroups,
    pinnedIds,
    groupOrder.orderedIds
  );

  useEffect(() => {
    const nonArchivedIds = conversations
      .filter((conv) => conv.type === "dm" || (conv.type === "group" && !conv.is_archived))
      .map((conv) => conv.id);
    cleanStalePins(nonArchivedIds);

    const dmIds = dmConversations.map((conv) => conv.id);
    const groupIds = activeGroups.map((conv) => conv.id);
    dmOrder.insertIfMissing(dmIds);
    dmOrder.removeStale(dmIds);
    groupOrder.insertIfMissing(groupIds);
    groupOrder.removeStale(groupIds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  const pinnedSet = new Set(pinnedIds);

  return (
    <>
      {(pinnedDMs.length > 0 || unpinnedDMs.length > 0) && (
        <CollapsibleSection title="Direct Messages" count={pinnedDMs.length + unpinnedDMs.length}>
          <SortableSection
            pinned={pinnedDMs}
            unpinned={unpinnedDMs}
            activeConversationId={activeConversationId}
            onlineUserIds={onlineUserIds}
            pinnedSet={pinnedSet}
            onTogglePin={togglePin}
            onReorder={dmOrder.reorder}
            getAgentHealthStatus={getAgentHealthStatus}
          />
        </CollapsibleSection>
      )}

      {(pinnedGroups.length > 0 || unpinnedGroups.length > 0 || archivedGroups.length > 0) && (
        <CollapsibleSection
          title="Groups"
          count={pinnedGroups.length + unpinnedGroups.length}
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
          <SortableSection
            pinned={pinnedGroups}
            unpinned={unpinnedGroups}
            activeConversationId={activeConversationId}
            onlineUserIds={onlineUserIds}
            pinnedSet={pinnedSet}
            onTogglePin={togglePin}
            onReorder={groupOrder.reorder}
          />

          {showArchived && archivedGroups.length > 0 && (
            <>
              {(pinnedGroups.length > 0 || unpinnedGroups.length > 0) && (
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
                  isDraggable={false}
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

function SortableConversationItem({
  conversation,
  isActive,
  isOnline,
  isPinned,
  onTogglePin,
  getAgentHealthStatus,
}: {
  conversation: ConversationWithDetails;
  isActive: boolean;
  isOnline: boolean;
  isPinned: boolean;
  onTogglePin: () => void;
  getAgentHealthStatus?: (agentId: string) => AgentHealthStatus;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: conversation.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ConversationItem
        conversation={conversation}
        isActive={isActive}
        isOnline={isOnline}
        isPinned={isPinned}
        onTogglePin={onTogglePin}
        isDraggable={true}
        dragHandleProps={{ ...attributes, ...listeners }}
        getAgentHealthStatus={getAgentHealthStatus}
      />
    </div>
  );
}

function ConversationItem({
  conversation,
  isActive,
  isOnline,
  isPinned,
  onTogglePin,
  isDraggable,
  dragHandleProps,
  hidePin = false,
  getAgentHealthStatus,
}: {
  conversation: ConversationWithDetails;
  isActive: boolean;
  isOnline: boolean;
  isPinned: boolean;
  onTogglePin: () => void;
  isDraggable: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  hidePin?: boolean;
  getAgentHealthStatus?: (agentId: string) => AgentHealthStatus;
}) {
  const isDM = conversation.type === "dm";
  const displayName = getDisplayName(conversation);

  return (
    <div className="relative group/item flex items-center">
      {isDraggable && (
        <div
          {...dragHandleProps}
          className="absolute left-0 z-10 w-4 h-full flex items-center justify-center opacity-0 group-hover/item:opacity-100 cursor-grab active:cursor-grabbing text-neutral-300 hover:text-neutral-400"
        >
          <GripVertical className="w-3 h-3" />
        </div>
      )}
      <Link
        href={`/chat/${conversation.id}`}
        className={`flex-1 flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition cursor-pointer ${
          isDraggable ? "pl-4" : ""
        } ${
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
                : "text-neutral-400 opacity-0 group-hover/item:opacity-100 hover:bg-neutral-100"
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
    </div>
  );
}
