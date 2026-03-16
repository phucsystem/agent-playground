"use client";

import { Avatar } from "@/components/ui/avatar";
import { Info, Users, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ConversationWithDetails } from "@/types/database";
import type { AgentHealthStatus } from "@/hooks/use-agent-health";

interface ChatHeaderProps {
  conversation: ConversationWithDetails;
  isOnline: boolean;
  onToggleInfo: () => void;
  agentHealthStatus?: AgentHealthStatus;
}

export function ChatHeader({
  conversation,
  isOnline,
  onToggleInfo,
  agentHealthStatus,
}: ChatHeaderProps) {
  const isDM = conversation.type === "dm";
  const router = useRouter();

  return (
    <div className="h-[var(--header-height)] border-b border-neutral-200 flex items-center px-3 md:px-6 gap-2 md:gap-3 shrink-0 bg-white">
      {/* Back button on mobile */}
      <button
        onClick={() => router.push("/chat")}
        className="md:hidden p-2 -ml-1 text-neutral-500 hover:text-neutral-700 transition cursor-pointer"
        aria-label="Back to conversations"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {isDM && conversation.other_user ? (
        (() => {
          const isAgent = conversation.other_user!.is_agent;
          const effectiveOnline = isAgent ? agentHealthStatus === "healthy" : isOnline;
          const statusLabel = isAgent
            ? (agentHealthStatus === "healthy" ? "Available" : "Unavailable")
            : (isOnline ? "Online" : "Offline");
          return (
            <>
              <Avatar
                displayName={conversation.other_user!.display_name}
                avatarUrl={conversation.other_user!.avatar_url}
                isAgent={isAgent}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-neutral-800 truncate">
                  {conversation.other_user!.display_name}
                </p>
                <p className="text-xs text-neutral-500 flex items-center gap-1">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      effectiveOnline ? "bg-success" : "bg-neutral-400"
                    }`}
                  />
                  {statusLabel}
                </p>
              </div>
            </>
          );
        })()

      ) : (
        <>
          <div className="text-sm font-bold text-neutral-800 truncate flex-1 min-w-0">
            # {conversation.name}
          </div>
          {conversation.member_count && (
            <button
              onClick={onToggleInfo}
              className="text-xs text-neutral-500 flex items-center gap-1 hover:text-neutral-700 transition shrink-0 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{conversation.member_count} members</span>
              <span className="sm:hidden">{conversation.member_count}</span>
            </button>
          )}
        </>
      )}

      <div className="ml-auto shrink-0">
        <button
          onClick={onToggleInfo}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition cursor-pointer"
          aria-label="Toggle chat info"
        >
          <Info className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
