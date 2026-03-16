"use client";

import { useState, useEffect } from "react";
import { toast, Toaster } from "sonner";
import { PresenceToast } from "@/components/ui/presence-toast";
import { formatRelativeTime } from "@/lib/session-utils";
import type { KickedSession } from "@/types/database";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar/sidebar";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSupabasePresence } from "@/hooks/use-supabase-presence";
import { useConversations } from "@/hooks/use-conversations";
import { MobileSidebarProvider, useMobileSidebar } from "@/hooks/use-mobile-sidebar";
import { CreateGroupDialog } from "@/components/sidebar/create-group-dialog";
import { Loader2 } from "lucide-react";

function ChatLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { currentUser, loading: userLoading } = useCurrentUser();
  const { onlineUsers, newlyOnlineUsers, clearNewlyOnline } = useSupabasePresence(currentUser);
  const { conversations } = useConversations();
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const { isOpen, close } = useMobileSidebar();

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
  const onlineUserIds = onlineUsers.map((onlineUser) => onlineUser.user_id);

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
    <div className="flex h-dvh">
      {/* Mobile sidebar overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={close}
        />
      )}

      {/* Sidebar: fixed on desktop, slide-over on mobile */}
      <div
        className={`
          fixed top-0 left-0 bottom-0 z-50
          w-[260px]
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
      >
        <Sidebar
          currentUser={currentUser}
          onlineUserIds={onlineUserIds}
          onlineUsers={onlineUsers}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onCreateGroup={() => setShowCreateGroup(true)}
        />
      </div>

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-h-dvh ml-0 md:ml-[var(--sidebar-width)]">
        {children}
      </main>

      {showCreateGroup && (
        <CreateGroupDialog
          currentUserId={currentUser.id}
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
