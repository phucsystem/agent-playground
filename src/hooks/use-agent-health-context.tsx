"use client";

import { createContext, useContext } from "react";
import type { AgentHealthStatus } from "./use-agent-health";

interface AgentHealthContextValue {
  getStatus: (agentId: string) => AgentHealthStatus;
  markActive: (agentId: string) => void;
}

export const AgentHealthContext = createContext<AgentHealthContextValue>({
  getStatus: () => "unknown",
  markActive: () => {},
});

export function useAgentHealthContext() {
  return useContext(AgentHealthContext);
}
