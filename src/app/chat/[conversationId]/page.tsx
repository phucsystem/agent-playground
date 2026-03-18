"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChatHeader } from "@/components/chat/chat-header";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatInfoPanel } from "@/components/chat/chat-info-panel";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useRealtimeMessages } from "@/hooks/use-realtime-messages";
import { useConversationsContext } from "@/contexts/conversations-context";
import { useTypingIndicator } from "@/hooks/use-typing-indicator";
import { useReactions } from "@/hooks/use-reactions";
import { useAgentThinking } from "@/hooks/use-agent-thinking";
import { useConversationMembers } from "@/hooks/use-conversation-members";
import { useAgentHealthContext } from "@/hooks/use-agent-health-context";
import { useReadReceipts } from "@/hooks/use-read-receipts";

import { usePresenceContext } from "@/contexts/presence-context";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;

  const { currentUser } = useCurrentUser();

  const { onlineUsers, onlineUserIds } = usePresenceContext();
  const { messages, loading, hasMore, loadMore, markAsRead, addOptimisticMessage, editMessage, deleteMessage } =
    useRealtimeMessages(conversationId);
  const { conversations, refetch: refetchConversations } = useConversationsContext();
  const [showInfo, setShowInfo] = useState(false);
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);

  const { typingUsers, sendTyping } = useTypingIndicator(
    conversationId,
    currentUser?.id || "",
    currentUser?.display_name || ""
  );

  const { fetchReactions, toggleReaction, getGroupedReactions } = useReactions(
    conversationId,
    currentUser?.id || ""
  );

  const conversation = useMemo(
    () => conversations.find((conv) => conv.id === conversationId),
    [conversations, conversationId]
  );

  const { getStatus: getAgentHealthStatus } = useAgentHealthContext();
  const { members } = useConversationMembers(conversationId);
  const hasAgent = useMemo(() => {
    if (conversation?.other_user?.is_agent) return true;
    return members.some((member) => member.user.is_agent);
  }, [conversation, members]);
  const { agentThinking } = useAgentThinking(messages, hasAgent);
  const memberNames = useMemo(
    () => members.map((member) => member.user.display_name),
    [members]
  );

  const readReceiptMembers = useMemo(
    () =>
      members.map((member) => ({
        userId: member.user_id,
        displayName: member.user.display_name,
        avatarUrl: member.user.avatar_url,
        isAgent: member.user.is_agent,
        lastReadAt: member.last_read_at,
      })),
    [members]
  );

  const { readReceiptsByMessageId } = useReadReceipts(
    messages,
    readReceiptMembers,
    currentUser?.id || ""
  );

  const isOtherOnline = useMemo(() => {
    if (!conversation?.other_user) return false;
    return onlineUserIds.includes(conversation.other_user.id);
  }, [conversation, onlineUserIds]);

  const isConversationAdmin = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === "admin") return true;
    const membership = members.find((member) => member.user_id === currentUser.id);
    return membership?.role === "admin";
  }, [currentUser, members]);

  const handleStartEdit = useCallback((messageId: string, messageContent: string) => {
    setEditingMessage({ id: messageId, content: messageContent });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
  }, []);

  const handleConfirmEdit = useCallback(async (messageId: string, newContent: string) => {
    setEditingMessage(null);
    const result = await editMessage(messageId, newContent);
    if (!result.success) {
      toast.error(`Failed to edit message: ${result.error}`);
    }
  }, [editMessage]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    toast("Delete this message?", {
      action: {
        label: "Delete",
        onClick: async () => {
          const result = await deleteMessage(messageId);
          if (!result.success) {
            toast.error(`Failed to delete: ${result.error}`);
          }
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => {},
      },
    });
  }, [deleteMessage]);

  const inputPlaceholder = conversation?.type === "group"
    ? `Message #${conversation?.name}...`
    : "Type a message...";

  useEffect(() => {
    markAsRead();
  }, [markAsRead]);

  useEffect(() => {
    if (messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.sender_id !== currentUser?.id) {
      markAsRead();
    }
  }, [markAsRead, messages.length, currentUser?.id]);

  useEffect(() => {
    const messageIds = messages.map((message) => message.id);
    fetchReactions(messageIds);
  }, [messages, fetchReactions]);

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

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <ChatHeader
          conversation={conversation}
          isOnline={isOtherOnline}
          onToggleInfo={() => setShowInfo(!showInfo)}
          agentHealthStatus={
            conversation.other_user?.is_agent
              ? getAgentHealthStatus(conversation.other_user.id)
              : undefined
          }
        />

        <MessageList
          messages={messages}
          loading={loading}
          hasMore={hasMore}
          loadMore={loadMore}
          currentUserId={currentUser.id}
          conversationId={conversationId}
          typingUsers={typingUsers}
          agentThinking={agentThinking}
          getGroupedReactions={getGroupedReactions}
          onToggleReaction={toggleReaction}
          onStartEdit={handleStartEdit}
          onDeleteMessage={handleDeleteMessage}
          canDeleteOthers={isConversationAdmin}
          isAdmin={currentUser.role === "admin"}
          memberNames={memberNames}
          readReceiptsByMessageId={readReceiptsByMessageId}
          isDm={conversation.type === "dm"}
        />

        {conversation.is_archived ? (
          <div className="mx-2 sm:mx-4 md:mx-6 mb-2 md:mb-4 px-4 py-3 bg-neutral-100 rounded-2xl text-center">
            <p className="text-sm text-neutral-500">This group is archived. You can read messages but cannot send new ones.</p>
          </div>
        ) : (
          <ChatInput
            conversationId={conversationId}
            senderId={currentUser.id}
            senderInfo={{
              id: currentUser.id,
              display_name: currentUser.display_name,
              avatar_url: currentUser.avatar_url,
              is_agent: currentUser.is_agent,
            }}
            placeholder={inputPlaceholder}
            onTyping={sendTyping}
            onOptimisticMessage={addOptimisticMessage}
            editingMessage={editingMessage}
            onCancelEdit={handleCancelEdit}
            onConfirmEdit={handleConfirmEdit}
          />
        )}
      </div>

      {showInfo && (
        <ChatInfoPanel
          conversation={conversation}
          onlineUserIds={onlineUserIds}
          currentUserId={currentUser.id}
          currentUserRole={currentUser.role}
          onClose={() => setShowInfo(false)}
          onConversationUpdate={refetchConversations}
        />
      )}
    </div>
  );
}
