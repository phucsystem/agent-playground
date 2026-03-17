"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { UserProfile } from "./user-profile";
import { AllUsers } from "./all-users";
import { ConversationList } from "./conversation-list";
import { Settings, X } from "lucide-react";
import Link from "next/link";
import packageJson from "../../../package.json";
import { useMobileSidebar } from "@/hooks/use-mobile-sidebar";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import type { User, ConversationWithDetails } from "@/types/database";
import type { AgentHealthStatus } from "@/hooks/use-agent-health";

interface SidebarProps {
  currentUser: User;
  onlineUserIds: string[];
  onlineUsers: { user_id: string; display_name: string; is_agent: boolean; avatar_url: string | null }[];
  conversations: ConversationWithDetails[];
  activeConversationId?: string;
  onCreateGroup: () => void;
  getAgentHealthStatus?: (agentId: string) => AgentHealthStatus;
  onAvatarSaved?: () => void;
}

export function Sidebar({
  currentUser,
  onlineUserIds,
  onlineUsers,
  conversations,
  activeConversationId,
  onCreateGroup,
  getAgentHealthStatus,
  onAvatarSaved,
}: SidebarProps) {
  const router = useRouter();
  const { close } = useMobileSidebar();
  const { activeWorkspace } = useWorkspaceContext();

  async function handleStartDM(otherUserId: string) {
    if (!activeWorkspace) return;
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.rpc("find_or_create_dm", {
      other_user_id: otherUserId,
      ws_id: activeWorkspace.id,
    });
    if (data) {
      router.push(`/chat/${data}`);
    }
  }

  async function handleLogout() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    localStorage.removeItem("agent_playground_token");
    router.push("/login");
  }

  return (
    <aside className="w-full h-full bg-white border-r border-neutral-200 flex flex-col z-50 overflow-hidden">
      <div className="flex items-center">
        <div className="flex-1">
          <UserProfile currentUser={currentUser} onLogout={handleLogout} onAvatarSaved={onAvatarSaved} />
        </div>
        <button
          onClick={close}
          className="md:hidden p-2 mr-2 text-neutral-400 hover:text-neutral-700 transition cursor-pointer"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversationId}
          onlineUserIds={onlineUserIds}
          currentUserId={currentUser.id}
          getAgentHealthStatus={getAgentHealthStatus}
        />

        <AllUsers
          currentUserId={currentUser.id}
          onlineUserIds={onlineUserIds}
          onClickUser={handleStartDM}
        />
      </div>

      <div className="p-3 border-t border-neutral-200 space-y-1.5">
        {currentUser.role === "admin" && (
          <button
            onClick={onCreateGroup}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-primary-50 text-primary-600 text-sm font-medium rounded-lg hover:bg-primary-100 transition cursor-pointer min-h-[44px]"
          >
            <span className="text-base leading-none">+</span>
            New Conversation
          </button>
        )}

        {currentUser.role === "admin" && (
          <Link
            href="/admin"
            className="w-full flex items-center justify-center gap-2 py-2 px-4 text-neutral-500 text-sm font-medium rounded-lg hover:bg-neutral-100 transition min-h-[44px]"
          >
            <Settings className="w-4 h-4" />
            Manage Users
          </Link>
        )}
        <p className="text-[10px] text-neutral-400 text-center pt-1">v{packageJson.version}</p>
      </div>
    </aside>
  );
}
