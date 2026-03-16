"use client";

import { createContext, useContext } from "react";
import type { OnlineUser } from "@/hooks/use-supabase-presence";

interface PresenceContextType {
  onlineUsers: OnlineUser[];
  onlineUserIds: string[];
}

const PresenceContext = createContext<PresenceContextType>({
  onlineUsers: [],
  onlineUserIds: [],
});

export const PresenceProvider = PresenceContext.Provider;

export function usePresenceContext() {
  return useContext(PresenceContext);
}
