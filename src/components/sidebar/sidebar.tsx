"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { UserProfile } from "./user-profile";
import { OnlineUsers } from "./online-users";
import { ConversationList } from "./conversation-list";
import type { User, ConversationWithDetails } from "@/types/database";
import { LogOut, Plus } from "lucide-react";

interface SidebarProps {
  currentUser: User;
  onlineUserIds: string[];
  onlineUsers: { user_id: string; display_name: string; is_agent: boolean; avatar_url: string | null }[];
  conversations: ConversationWithDetails[];
  activeConversationId?: string;
  onCreateGroup: () => void;
}

export function Sidebar({
  currentUser,
  onlineUserIds,
  onlineUsers,
  conversations,
  activeConversationId,
  onCreateGroup,
}: SidebarProps) {
  const router = useRouter();

  async function handleStartDM(otherUserId: string) {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.rpc("find_or_create_dm", {
      other_user_id: otherUserId,
    });
    if (data) {
      router.push(`/chat/${data}`);
    }
  }

  async function handleLogout() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="w-[var(--sidebar-width)] bg-white border-r border-neutral-200 fixed top-0 left-0 bottom-0 flex flex-col z-50 overflow-hidden">
      <UserProfile currentUser={currentUser} onLogout={handleLogout} />

      <div className="flex-1 overflow-y-auto">
        <OnlineUsers
          users={onlineUsers.filter((onlineUser) => onlineUser.user_id !== currentUser.id)}
          onClickUser={handleStartDM}
        />

        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversationId}
          onlineUserIds={onlineUserIds}
        />
      </div>

      <div className="p-3 border-t border-neutral-200">
        <button
          onClick={onCreateGroup}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-primary-100 text-primary-500 text-sm font-medium rounded-lg hover:bg-primary-200 transition"
        >
          <Plus className="w-4 h-4" />
          New chat
        </button>
      </div>
    </aside>
  );
}
