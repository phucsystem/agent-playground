"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast, Toaster } from "sonner";
import { PresenceToast } from "@/components/ui/presence-toast";
import { formatRelativeTime } from "@/lib/session-utils";
import type { KickedSession, User } from "@/types/database";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar/sidebar";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSupabasePresence } from "@/hooks/use-supabase-presence";
import { MobileSidebarProvider, useMobileSidebar } from "@/hooks/use-mobile-sidebar";
import { useAgentHealth } from "@/hooks/use-agent-health";
import { AgentHealthContext } from "@/hooks/use-agent-health-context";
import { AgentHealthToast } from "@/components/ui/agent-health-toast";
import { CreateGroupDialog } from "@/components/sidebar/create-group-dialog";
import { useNotificationSound } from "@/hooks/use-notification-sound";
import { NotificationContext } from "@/hooks/use-notification-context";
import { WorkspaceProvider, useWorkspaceContext } from "@/contexts/workspace-context";
import { ConversationsProvider, useConversationsContext } from "@/contexts/conversations-context";
import { PresenceProvider } from "@/contexts/presence-context";
import { WorkspaceRail } from "@/components/sidebar/workspace-rail";
import { WorkspaceAvatar } from "@/components/ui/workspace-avatar";
import { FlipLoader } from "@/components/ui/flip-loader";
import { useWorkspaceUnread } from "@/hooks/use-workspace-unread";

function ConversationsProviderWrapper({ children }: { children: React.ReactNode }) {
  const { activeWorkspace } = useWorkspaceContext();
  return (
    <ConversationsProvider workspaceId={activeWorkspace?.id ?? null}>
      {children}
    </ConversationsProvider>
  );
}

function ChatLayoutContent({ children, currentUser, onRefreshUser }: { children: React.ReactNode; currentUser: User; onRefreshUser: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { workspaces, activeWorkspace, switchWorkspace, loading: workspaceLoading } = useWorkspaceContext();
  const { onlineUsers, newlyOnlineUsers, clearNewlyOnline, markUserOnline } = useSupabasePresence(currentUser, activeWorkspace?.id ?? null);
  const { conversations, refetch: refetchConversations } = useConversationsContext();
  const { getStatus: getAgentHealthStatus, transitions: healthTransitions, clearTransitions: clearHealthTransitions, markActive } = useAgentHealth();
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const { isOpen, close } = useMobileSidebar();
  const { unreadByWorkspace } = useWorkspaceUnread(activeWorkspace?.id ?? null);
  const previousWorkspaceId = useRef<string | null>(activeWorkspace?.id ?? null);
  const pendingWorkspaceSwitch = useRef(false);

  const { triggerTestNotification } = useNotificationSound(currentUser, conversations);

  const activeConversationId = pathname.split("/chat/")[1];

  // Detect workspace switch
  useEffect(() => {
    if (activeWorkspace?.id && activeWorkspace.id !== previousWorkspaceId.current) {
      if (previousWorkspaceId.current !== null) {
        pendingWorkspaceSwitch.current = true;
      }
      previousWorkspaceId.current = activeWorkspace.id;
    }
  }, [activeWorkspace?.id]);

  // Navigate to most recent conversation after workspace switch
  useEffect(() => {
    if (!pendingWorkspaceSwitch.current || conversations.length === 0) return;
    pendingWorkspaceSwitch.current = false;

    const mostRecent = conversations.reduce((latest, conv) => {
      const latestTime = latest.last_message?.created_at ?? latest.updated_at;
      const convTime = conv.last_message?.created_at ?? conv.updated_at;
      return convTime > latestTime ? conv : latest;
    }, conversations[0]);

    router.push(`/chat/${mostRecent.id}`);
  }, [conversations, router]);

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
        <FlipLoader size="lg" label="Loading..." />
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
      <div className="hidden md:flex w-[60px] shrink-0 bg-gradient-to-b from-primary-950 via-primary-900 to-primary-950">
        <WorkspaceRail
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspace?.id ?? null}
          onSwitch={switchWorkspace}
          isAdmin={currentUser?.role === "admin"}
          unreadByWorkspace={unreadByWorkspace}
        />
      </div>

      {/* Sidebar: fixed on desktop, slide-over on mobile */}
      <div
        className={`
          fixed top-0 left-0 bottom-0 z-50
          w-[260px]
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:relative md:z-auto md:shrink-0
        `}
      >
        {/* Mobile workspace strip */}
        <div className="md:hidden flex items-center gap-1 px-2 py-1.5 bg-gradient-to-r from-[#1e1b4b] to-[#4c1d95] overflow-x-auto">
          {workspaces.map((workspace) => {
            const unreadCount = unreadByWorkspace[workspace.id] ?? 0;
            return (
              <button
                key={workspace.id}
                onClick={() => switchWorkspace(workspace.id)}
                className={`relative shrink-0 rounded-full transition cursor-pointer ${
                  workspace.id === activeWorkspace?.id
                    ? "ring-2 ring-primary-300"
                    : ""
                }`}
                title={workspace.name}
              >
                <WorkspaceAvatar workspace={workspace} size="sm" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] flex items-center justify-center bg-error text-white text-[8px] font-bold rounded-full px-0.5">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <Sidebar
          currentUser={currentUser}
          onlineUserIds={onlineUserIds}
          onlineUsers={onlineUsers}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onCreateGroup={() => setShowCreateGroup(true)}
          getAgentHealthStatus={getAgentHealthStatus}
          onAvatarSaved={onRefreshUser}
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
          onGroupCreated={refetchConversations}
        />
      )}

      <Toaster
        position="top-right"
        visibleToasts={3}
        toastOptions={{
          duration: 3000,
          unstyled: true,
          classNames: {
            toast: "flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-sm w-[360px] pointer-events-auto",
            title: "text-sm font-medium",
            description: "text-xs opacity-80",
            error: "bg-red-50 border-red-200 text-red-800",
            success: "bg-emerald-50 border-emerald-200 text-emerald-800",
            info: "bg-sky-50 border-sky-200 text-sky-800",
            warning: "bg-amber-50 border-amber-200 text-amber-800",
            default: "bg-white border-neutral-200 text-neutral-800",
          },
        }}
      />
    </div>
  );
}

function ChatLayoutInner({ children }: { children: React.ReactNode }) {
  const { currentUser, loading: userLoading, refreshUser } = useCurrentUser();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (userLoading || !splashDone) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <FlipLoader size="lg" label="Loading..." />
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
      <ConversationsProviderWrapper>
        <ChatLayoutContent currentUser={currentUser} onRefreshUser={refreshUser}>{children}</ChatLayoutContent>
      </ConversationsProviderWrapper>
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
