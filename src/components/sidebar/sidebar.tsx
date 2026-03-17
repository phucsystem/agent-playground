"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { UserProfile } from "./user-profile";
import { AllUsers } from "./all-users";
import { ConversationList } from "./conversation-list";
import { SearchInput } from "./search-input";
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

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [messageMatchConvIds, setMessageMatchConvIds] = useState<Set<string>>(new Set());
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(value), 150);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setMessageMatchConvIds(new Set());
      setIsSearchingMessages(false);
      return;
    }

    let cancelled = false;
    setIsSearchingMessages(true);

    async function searchMessages() {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase
        .from("messages")
        .select("conversation_id")
        .ilike("content", `%${debouncedQuery}%`)
        .limit(50);

      if (cancelled) return;

      if (data) {
        const convIds = new Set(data.map((row) => row.conversation_id));
        setMessageMatchConvIds(convIds);
      }
      setIsSearchingMessages(false);
    }

    searchMessages();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isMod = event.metaKey || event.ctrlKey;
      if (isMod && event.key === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

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
    <aside className="w-full h-full bg-white border-r border-neutral-100 flex flex-col z-50 overflow-hidden">
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

      <SearchInput
        ref={searchInputRef}
        value={searchQuery}
        onChange={handleSearchChange}
        placeholder="Search... (⌘K)"
      />

      <div className="flex-1 overflow-y-auto">
        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversationId}
          onlineUserIds={onlineUserIds}
          currentUserId={currentUser.id}
          getAgentHealthStatus={getAgentHealthStatus}
          searchQuery={debouncedQuery}
          messageMatchConvIds={messageMatchConvIds}
          isSearchingMessages={isSearchingMessages}
        />

        <AllUsers
          currentUserId={currentUser.id}
          onlineUserIds={onlineUserIds}
          onClickUser={handleStartDM}
          searchQuery={debouncedQuery}
        />
      </div>

      <div className="p-3 border-t border-neutral-100 space-y-1.5">
        {currentUser.role === "admin" && (
          <button
            onClick={onCreateGroup}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-primary-50 to-accent-50 text-accent-600 text-sm font-medium rounded-lg hover:from-primary-100 hover:to-accent-100 transition cursor-pointer"
          >
            <span className="text-base leading-none">+</span>
            New Conversation
          </button>
        )}

        {currentUser.role === "admin" && (
          <Link
            href="/admin"
            className="w-full flex items-center justify-center gap-2 py-2 px-4 text-neutral-500 text-sm font-medium rounded-lg hover:bg-neutral-100 transition"
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
