# Phase 3: React Hook

**Priority:** High
**Status:** completed
**Effort:** S (Small)
**Depends on:** Phase 2

## Overview

`useAgentHealth()` hook polls `/api/agents/health` every 5 minutes. Returns a status map and tracks status transitions for toast notifications.

## Related Files

**Create:**
- `src/hooks/use-agent-health.ts`

## Implementation Steps

### 1. Create Hook

File: `src/hooks/use-agent-health.ts`

```typescript
"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type AgentHealthStatus = "healthy" | "unhealthy" | "unknown";

interface AgentHealthEntry {
  agentId: string;
  status: AgentHealthStatus;
  checkedAt: string;
}

interface AgentHealthTransition {
  agentId: string;
  previousStatus: AgentHealthStatus;
  newStatus: AgentHealthStatus;
}

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useAgentHealth() {
  const [healthMap, setHealthMap] = useState<Map<string, AgentHealthStatus>>(new Map());
  const [transitions, setTransitions] = useState<AgentHealthTransition[]>([]);
  const previousMapRef = useRef<Map<string, AgentHealthStatus>>(new Map());
  const isInitialRef = useRef(true);

  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch("/api/agents/health");
      if (!response.ok) return;
      const data = await response.json();
      const newMap = new Map<string, AgentHealthStatus>();

      for (const entry of data.agents as AgentHealthEntry[]) {
        newMap.set(entry.agentId, entry.status);
      }

      // Detect transitions (skip initial load)
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
      // Network error — leave current state unchanged
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
    [healthMap]
  );

  return { healthMap, transitions, clearTransitions, getStatus };
}
```

### Key Points

- `getStatus(agentId)` returns `'healthy' | 'unhealthy' | 'unknown'`
- `transitions` array populated on each poll with status changes (for toasts)
- `clearTransitions()` called after toasts shown
- Initial fetch doesn't fire transitions (prevents flood of toasts on page load)
- 5-min polling matches server cache TTL

## Todo

- [x] Create `src/hooks/use-agent-health.ts`
- [x] Compile check

## Success Criteria

- Hook fetches on mount and every 5 min
- `getStatus()` returns correct status per agent
- Transitions detected on status changes (not on initial load)
