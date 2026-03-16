"use client";

import { X, LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useConversationMembers } from "@/hooks/use-conversation-members";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { ConversationWithDetails } from "@/types/database";

interface ChatInfoPanelProps {
  conversation: ConversationWithDetails;
  onlineUserIds: string[];
  currentUserId: string;
  onClose: () => void;
}

export function ChatInfoPanel({
  conversation,
  onlineUserIds,
  currentUserId,
  onClose,
}: ChatInfoPanelProps) {
  const { members } = useConversationMembers(conversation.id);
  const router = useRouter();
  const isGroup = conversation.type === "group";

  async function handleLeaveGroup() {
    const supabase = createBrowserSupabaseClient();
    await supabase
      .from("conversation_members")
      .delete()
      .eq("conversation_id", conversation.id)
      .eq("user_id", currentUserId);
    router.push("/chat");
  }

  return (
    <div className="w-[var(--info-panel-width)] border-l border-neutral-200 bg-white h-full overflow-y-auto shrink-0">
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 sticky top-0 bg-white z-10">
        <h3 className="text-sm font-semibold text-neutral-800">Chat Info</h3>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-5 py-4 border-b border-neutral-100">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-3">
          Members ({members.length})
        </p>
        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.user_id} className="flex items-center gap-2.5">
              <Avatar
                displayName={member.user.display_name}
                avatarUrl={member.user.avatar_url}
                isAgent={member.user.is_agent}
                size="sm"
                showPresence
                isOnline={onlineUserIds.includes(member.user_id)}
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-neutral-700 truncate block">
                  {member.user.display_name}
                </span>
              </div>
              {member.role === "admin" && (
                <span className="text-[10px] text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                  admin
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {isGroup && (
        <div className="px-5 py-4">
          <button
            onClick={handleLeaveGroup}
            className="w-full text-left text-sm text-error hover:bg-red-50 px-3 py-2 rounded-lg transition"
          >
            <LogOut className="w-4 h-4 inline mr-2" />
            Leave group
          </button>
        </div>
      )}
    </div>
  );
}
