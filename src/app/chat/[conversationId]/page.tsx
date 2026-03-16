"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { ChatHeader } from "@/components/chat/chat-header";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatInfoPanel } from "@/components/chat/chat-info-panel";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useRealtimeMessages } from "@/hooks/use-realtime-messages";
import { useConversations } from "@/hooks/use-conversations";
import { useSupabasePresence } from "@/hooks/use-supabase-presence";
import { Loader2 } from "lucide-react";

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;

  const { currentUser } = useCurrentUser();
  const { messages, loading, hasMore, loadMore, markAsRead } =
    useRealtimeMessages(conversationId);
  const { conversations } = useConversations();
  const { onlineUsers } = useSupabasePresence(currentUser);
  const [showInfo, setShowInfo] = useState(false);

  const conversation = useMemo(
    () => conversations.find((conv) => conv.id === conversationId),
    [conversations, conversationId]
  );

  const onlineUserIds = useMemo(
    () => onlineUsers.map((onlineUser) => onlineUser.user_id),
    [onlineUsers]
  );

  const isOtherOnline = useMemo(() => {
    if (!conversation?.other_user) return false;
    return onlineUserIds.includes(conversation.other_user.id);
  }, [conversation, onlineUserIds]);

  useEffect(() => {
    markAsRead();
  }, [markAsRead, messages.length]);

  if (!currentUser) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-neutral-400">Loading conversation...</p>
      </div>
    );
  }

  const inputPlaceholder =
    conversation.type === "group"
      ? `Message #${conversation.name}...`
      : "Type a message...";

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex-1 flex flex-col min-w-0">
        <ChatHeader
          conversation={conversation}
          isOnline={isOtherOnline}
          onToggleInfo={() => setShowInfo(!showInfo)}
        />

        <MessageList
          messages={messages}
          loading={loading}
          hasMore={hasMore}
          loadMore={loadMore}
          currentUserId={currentUser.id}
        />

        <ChatInput
          conversationId={conversationId}
          senderId={currentUser.id}
          placeholder={inputPlaceholder}
        />
      </div>

      {showInfo && (
        <ChatInfoPanel
          conversation={conversation}
          onlineUserIds={onlineUserIds}
          currentUserId={currentUser.id}
          onClose={() => setShowInfo(false)}
        />
      )}
    </div>
  );
}
