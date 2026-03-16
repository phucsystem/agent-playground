"use client";

import { useState, useEffect, useCallback } from "react";
import { toast, Toaster } from "sonner";
import { PresenceToast } from "@/components/ui/presence-toast";
import { formatRelativeTime } from "@/lib/session-utils";
import type { KickedSession, User } from "@/types/database";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar/sidebar";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSupabasePresence } from "@/hooks/use-supabase-presence";
import { useConversations } from "@/hooks/use-conversations";
import { MobileSidebarProvider, useMobileSidebar } from "@/hooks/use-mobile-sidebar";
import { useAgentHealth } from "@/hooks/use-agent-health";
import { AgentHealthContext } from "@/hooks/use-agent-health-context";
import { AgentHealthToast } from "@/components/ui/agent-health-toast";
import { CreateGroupDialog } from "@/components/sidebar/create-group-dialog";
import { useNotificationSound } from "@/hooks/use-notification-sound";
import { NotificationContext } from "@/hooks/use-notification-context";
import { WorkspaceProvider, useWorkspaceContext } from "@/contexts/workspace-context";
import { PresenceProvider } from "@/contexts/presence-context";
import { WorkspaceRail } from "@/components/sidebar/workspace-rail";
import { WorkspaceAvatar } from "@/components/ui/workspace-avatar";
import { Loader2 } from "lucide-react";

function ChatLayoutContent({ children, currentUser }: { children: React.ReactNode; currentUser: User }) {
  const pathname = usePathname();
  const { workspaces, activeWorkspace, switchWorkspace, loading: workspaceLoading } = useWorkspaceContext();
  const { onlineUsers, newlyOnlineUsers, clearNewlyOnline, markUserOnline } = useSupabasePresence(currentUser, activeWorkspace?.id ?? null);
  const { conversations } = useConversations(activeWorkspace?.id ?? null);
  const { getStatus: getAgentHealthStatus, transitions: healthTransitions, clearTransitions: clearHealthTransitions, markActive } = useAgentHealth();
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const { isOpen, close } = useMobileSidebar();

  const { triggerTestNotification } = useNotificationSound(currentUser, conversations);

  const activeConversationId = pathname.split("/chat/")[1];

  useEffect(() => {
    const kickedRaw = sessionStorage.getItem("kicked_session");
    if (kickedRaw) {
      sessionStorage.removeItem("kicked_session");
      try {
        const kicked = JSON.parse(kickedRaw) as KickedSession;
        toast.info(
          `Signed out from ${kicked.device_name} (${formatRelativeTime(kicked.last_active_at)})`,
          { duration: 5000 }
        );
      } catch {
        // Ignore malformed data
      }
    }
  }, []);

  useEffect(() => {
    if (newlyOnlineUsers.length === 0) return;

    for (const user of newlyOnlineUsers) {
      toast.custom(
        () => (
          <PresenceToast
            displayName={user.display_name}
            avatarUrl={user.avatar_url}
          />
        ),
        { id: `presence-${user.user_id}` }
      );
    }

    clearNewlyOnline();
  }, [newlyOnlineUsers, clearNewlyOnline]);

  useEffect(() => {
    if (healthTransitions.length === 0) return;

    for (const transition of healthTransitions) {
      const agentConv = conversations.find(
        (conv) => conv.type === "dm" && conv.other_user?.id === transition.agentId && conv.other_user?.is_agent,
      );
      const agentName = agentConv?.other_user?.display_name || "Agent";
      const avatarUrl = agentConv?.other_user?.avatar_url || null;

      toast.custom(
        () => (
          <AgentHealthToast
            displayName={agentName}
            avatarUrl={avatarUrl}
            status={transition.newStatus}
          />
        ),
        { id: `health-${transition.agentId}`, duration: 4000 },
      );
    }

    clearHealthTransitions();
  }, [healthTransitions, clearHealthTransitions, conversations]);

  const handleMessageReceived = useCallback((event: Event) => {
    const { senderId, isAgent } = (event as CustomEvent).detail;
    if (isAgent) {
      markActive(senderId);
    } else {
      markUserOnline(senderId);
    }
  }, [markActive, markUserOnline]);

  useEffect(() => {
    window.addEventListener("message-received", handleMessageReceived);
    return () => window.removeEventListener("message-received", handleMessageReceived);
  }, [handleMessageReceived]);

  const onlineUserIds = onlineUsers.map((onlineUser) => onlineUser.user_id);

  if (workspaceLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh">
      {/* Mobile sidebar overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={close}
        />
      )}

      {/* Workspace Rail - always visible on desktop */}
      <div className="hidden md:flex w-[60px] shrink-0 bg-neutral-800">
        <WorkspaceRail
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspace?.id ?? null}
          onSwitch={switchWorkspace}
          isAdmin={currentUser?.role === "admin"}
        />
      </div>

      {/* Sidebar: fixed on desktop, slide-over on mobile */}
      <div
        className={`
          fixed top-0 left-0 bottom-0 z-50
          w-[260px]
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:relative md:z-auto
        `}
      >
        {/* Mobile workspace strip */}
        <div className="md:hidden flex items-center gap-1 px-2 py-1.5 bg-neutral-800 overflow-x-auto">
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              onClick={() => switchWorkspace(workspace.id)}
              className={`shrink-0 rounded-full transition ${
                workspace.id === activeWorkspace?.id
                  ? "ring-2 ring-primary-300"
                  : ""
              }`}
              title={workspace.name}
            >
              <WorkspaceAvatar workspace={workspace} size="sm" />
            </button>
          ))}
        </div>

        <Sidebar
          currentUser={currentUser}
          onlineUserIds={onlineUserIds}
          onlineUsers={onlineUsers}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onCreateGroup={() => setShowCreateGroup(true)}
          getAgentHealthStatus={getAgentHealthStatus}
        />
      </div>

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-h-dvh ml-0 md:ml-0">
        <PresenceProvider value={{ onlineUsers, onlineUserIds }}>
          <AgentHealthContext.Provider value={{ getStatus: getAgentHealthStatus, markActive }}>
            <NotificationContext.Provider value={{ triggerTestNotification }}>
              {children}
            </NotificationContext.Provider>
          </AgentHealthContext.Provider>
        </PresenceProvider>
      </main>

      {showCreateGroup && activeWorkspace && (
        <CreateGroupDialog
          currentUserId={currentUser.id}
          workspaceId={activeWorkspace.id}
          onClose={() => setShowCreateGroup(false)}
        />
      )}

      <Toaster
        position="top-right"
        visibleToasts={3}
        toastOptions={{ duration: 3000, unstyled: true }}
      />
    </div>
  );
}

function ChatLayoutInner({ children }: { children: React.ReactNode }) {
  const { currentUser, loading: userLoading } = useCurrentUser();

  if (userLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <p className="text-neutral-500">Unable to load user profile.</p>
      </div>
    );
  }

  return (
    <WorkspaceProvider userId={currentUser.id}>
      <ChatLayoutContent currentUser={currentUser}>{children}</ChatLayoutContent>
    </WorkspaceProvider>
  );
}

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MobileSidebarProvider>
      <ChatLayoutInner>{children}</ChatLayoutInner>
    </MobileSidebarProvider>
  );
}
