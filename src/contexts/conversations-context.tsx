"use client";

import { createContext, useContext } from "react";
import { useConversations } from "@/hooks/use-conversations";
import type { ConversationWithDetails } from "@/types/database";

interface ConversationsContextType {
  conversations: ConversationWithDetails[];
  loading: boolean;
  refetch: () => void;
}

const ConversationsContext = createContext<ConversationsContextType>({
  conversations: [],
  loading: true,
  refetch: () => {},
});

export function ConversationsProvider({
  workspaceId,
  children,
}: {
  workspaceId: string | null;
  children: React.ReactNode;
}) {
  const value = useConversations(workspaceId);
  return (
    <ConversationsContext.Provider value={value}>
      {children}
    </ConversationsContext.Provider>
  );
}

export function useConversationsContext() {
  return useContext(ConversationsContext);
}
