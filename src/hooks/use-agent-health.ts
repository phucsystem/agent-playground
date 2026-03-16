"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type AgentHealthStatus = "healthy" | "unhealthy" | "unknown";

interface AgentHealthEntry {
  agentId: string;
  status: "healthy" | "unhealthy";
  checkedAt: string;
}

export interface AgentHealthTransition {
  agentId: string;
  previousStatus: AgentHealthStatus;
  newStatus: AgentHealthStatus;
}

const POLL_INTERVAL_MS = 5 * 60 * 1000;

export function useAgentHealth() {
  const [healthMap, setHealthMap] = useState<Map<string, AgentHealthStatus>>(new Map());
  const [transitions, setTransitions] = useState<AgentHealthTransition[]>([]);
  const previousMapRef = useRef<Map<string, AgentHealthStatus>>(new Map());
  const isInitialRef = useRef(true);

  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch("/api/agents/health");
      if (!response.ok) return;

      const data: { agents: AgentHealthEntry[] } = await response.json();
      const newMap = new Map<string, AgentHealthStatus>();

      for (const entry of data.agents) {
        newMap.set(entry.agentId, entry.status);
      }

      if (!isInitialRef.current) {
        const newTransitions: AgentHealthTransition[] = [];
        for (const [agentId, newStatus] of newMap) {
          const previousStatus = previousMapRef.current.get(agentId) || "unknown";
          if (previousStatus !== newStatus) {
            newTransitions.push({ agentId, previousStatus, newStatus });
          }
        }
        if (newTransitions.length > 0) {
          setTransitions(newTransitions);
        }
      } else {
        isInitialRef.current = false;
      }

      previousMapRef.current = newMap;
      setHealthMap(newMap);
    } catch {
      // Network error — keep current state
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const clearTransitions = useCallback(() => {
    setTransitions([]);
  }, []);

  const getStatus = useCallback(
    (agentId: string): AgentHealthStatus => healthMap.get(agentId) || "unknown",
    [healthMap],
  );

  return { healthMap, transitions, clearTransitions, getStatus };
}
