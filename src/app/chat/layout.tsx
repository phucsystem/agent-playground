"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar/sidebar";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSupabasePresence } from "@/hooks/use-supabase-presence";
import { useConversations } from "@/hooks/use-conversations";
import { CreateGroupDialog } from "@/components/sidebar/create-group-dialog";
import { Loader2 } from "lucide-react";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { currentUser, loading: userLoading } = useCurrentUser();
  const { onlineUsers } = useSupabasePresence(currentUser);
  const { conversations } = useConversations();
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const activeConversationId = pathname.split("/chat/")[1];
  const onlineUserIds = onlineUsers.map((onlineUser) => onlineUser.user_id);

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-500">Unable to load user profile.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        currentUser={currentUser}
        onlineUserIds={onlineUserIds}
        onlineUsers={onlineUsers}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onCreateGroup={() => setShowCreateGroup(true)}
      />

      <main className="flex-1 ml-[var(--sidebar-width)] flex flex-col min-h-screen">
        {children}
      </main>

      {showCreateGroup && (
        <CreateGroupDialog
          currentUserId={currentUser.id}
          onClose={() => setShowCreateGroup(false)}
        />
      )}
    </div>
  );
}
