"use client";

import { Avatar } from "@/components/ui/avatar";
import { Info, Users } from "lucide-react";
import type { ConversationWithDetails } from "@/types/database";

interface ChatHeaderProps {
  conversation: ConversationWithDetails;
  isOnline: boolean;
  onToggleInfo: () => void;
}

export function ChatHeader({
  conversation,
  isOnline,
  onToggleInfo,
}: ChatHeaderProps) {
  const isDM = conversation.type === "dm";

  return (
    <div className="h-[var(--header-height)] border-b border-neutral-200 flex items-center px-6 gap-3 shrink-0 bg-white">
      {isDM && conversation.other_user ? (
        <>
          <Avatar
            displayName={conversation.other_user.display_name}
            avatarUrl={conversation.other_user.avatar_url}
            isAgent={conversation.other_user.is_agent}
            size="sm"
          />
          <div>
            <p className="text-sm font-bold text-neutral-800">
              {conversation.other_user.display_name}
            </p>
            <p className="text-xs text-neutral-500 flex items-center gap-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  isOnline ? "bg-success" : "bg-neutral-400"
                }`}
              />
              {isOnline ? "Online" : "Offline"}
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="text-sm font-bold text-neutral-800">
            # {conversation.name}
          </div>
          {conversation.member_count && (
            <button
              onClick={onToggleInfo}
              className="text-xs text-neutral-500 flex items-center gap-1 hover:text-neutral-700 transition"
            >
              <Users className="w-3.5 h-3.5" />
              {conversation.member_count} members
            </button>
          )}
        </>
      )}

      <div className="ml-auto">
        <button
          onClick={onToggleInfo}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
        >
          <Info className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
