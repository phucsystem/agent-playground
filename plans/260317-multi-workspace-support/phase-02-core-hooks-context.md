---
phase: 2
status: complete
priority: critical
effort: medium
---

# Phase 2: Core Hooks & Context

## Context

- [Phase 1: Database](./phase-01-database-migration.md) — must be complete first
- [Codebase Summary](../../docs/codebase-summary.md) — hooks-first data layer pattern

## Overview

Create workspace context provider, workspace hooks, and update existing hooks to be workspace-aware. This phase provides the data layer that all UI components depend on.

## Key Insights

- Current hooks use global scope — no workspace filtering
- Presence channel is `online-users` (global) — needs per-workspace scoping
- Conversations fetched via `get_my_conversations` RPC — needs workspace param
- Active workspace stored in localStorage (matches pinned conversations pattern)
- `useConversations` already has realtime subscription — update channel name

## Requirements

**Functional:**
- WorkspaceProvider context wrapping chat layout
- `useWorkspaces()` hook — fetch user's workspaces
- `useActiveWorkspace()` hook — get/set active workspace from localStorage
- Update `useConversations()` — filter by active workspace
- Update `useSupabasePresence()` — scope to active workspace
- Update DM creation flow — pass workspace_id

**Non-functional:**
- Workspace switch should be fast (client-side state + re-fetch)
- No flash of wrong workspace data on switch

## Related Code Files

**Create:**
- `src/contexts/workspace-context.tsx` — WorkspaceProvider + useWorkspaceContext
- `src/hooks/use-workspaces.ts` — fetch user's workspaces list

**Modify:**
- `src/app/chat/layout.tsx` — wrap with WorkspaceProvider
- `src/hooks/use-conversations.ts` — accept workspace_id, pass to RPC
- `src/hooks/use-supabase-presence.ts` — scope channel by workspace
- `src/components/sidebar/sidebar.tsx` — pass workspace_id to DM creation

## Implementation Steps

### Step 1: Create workspace context (`src/contexts/workspace-context.tsx`)

```typescript
"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Workspace } from "@/types/database";

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  switchWorkspace: (workspaceId: string) => void;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspaces: [],
  activeWorkspace: null,
  switchWorkspace: () => {},
  loading: true,
});

export function useWorkspaceContext() {
  return useContext(WorkspaceContext);
}

export function WorkspaceProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Load workspaces
  useEffect(() => {
    async function fetchWorkspaces() {
      const { data } = await supabase
        .from("workspace_members")
        .select("workspace:workspaces(*)")
        .eq("user_id", userId);

      const workspaceList = data?.map((row) => row.workspace).filter(Boolean) ?? [];
      setWorkspaces(workspaceList);

      // Restore active workspace from localStorage, fallback to default
      const stored = localStorage.getItem(`active_workspace_${userId}`);
      const storedExists = workspaceList.some((ws) => ws.id === stored);

      if (stored && storedExists) {
        setActiveWorkspaceId(stored);
      } else {
        const defaultWs = workspaceList.find((ws) => ws.is_default) ?? workspaceList[0];
        if (defaultWs) setActiveWorkspaceId(defaultWs.id);
      }

      setLoading(false);
    }
    fetchWorkspaces();
  }, [userId, supabase]);

  const switchWorkspace = useCallback((workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
    localStorage.setItem(`active_workspace_${userId}`, workspaceId);
  }, [userId]);

  const activeWorkspace = workspaces.find((ws) => ws.id === activeWorkspaceId) ?? null;

  return (
    <WorkspaceContext.Provider value={{ workspaces, activeWorkspace, switchWorkspace, loading }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
```

### Step 2: Update `use-conversations.ts`

Add workspace_id parameter to the hook and pass to RPC:

```typescript
export function useConversations(workspaceId: string | null) {
  // ... existing state ...

  useEffect(() => {
    if (!workspaceId) return;

    async function fetchConversations() {
      const { data } = await supabase.rpc("get_my_conversations");
      // Filter by workspace on client side (RLS already filters by membership)
      // OR update RPC to accept workspace_id
      const filtered = data?.filter((conv) => conv.workspace_id === workspaceId) ?? [];
      setConversations(filtered);
    }
    fetchConversations();
  }, [workspaceId]);

  // Update realtime channel to be workspace-specific
  // Channel: `conversation-updates-${workspaceId}`
}
```

### Step 3: Update `use-supabase-presence.ts`

Scope presence channel by workspace:

```typescript
export function useSupabasePresence(
  currentUser: User | null,
  workspaceId: string | null
) {
  // Change channel from "online-users" to `online-users-${workspaceId}`
  // Re-subscribe when workspaceId changes
  // Track workspace_id in presence payload
}
```

### Step 4: Update `chat/layout.tsx`

Wrap existing providers with WorkspaceProvider:

```typescript
// In ChatLayoutInner, after useCurrentUser:
<WorkspaceProvider userId={currentUser.id}>
  {/* existing providers */}
  <MobileSidebarProvider>
    ...
  </MobileSidebarProvider>
</WorkspaceProvider>
```

Pass `activeWorkspace.id` to `useConversations` and `useSupabasePresence`.

### Step 5: Update sidebar DM creation

In `sidebar.tsx`, update `handleStartDM`:

```typescript
const { activeWorkspace } = useWorkspaceContext();

async function handleStartDM(otherUserId: string) {
  if (!activeWorkspace) return;
  const { data } = await supabase.rpc("find_or_create_dm", {
    other_user_id: otherUserId,
    ws_id: activeWorkspace.id,
  });
  // navigate to conversation
}
```

## Todo List

- [x] Create `src/contexts/workspace-context.tsx`
- [x] Update `src/hooks/use-conversations.ts` — add workspace filtering
- [x] Update `src/hooks/use-supabase-presence.ts` — scope by workspace
- [x] Update `src/app/chat/layout.tsx` — add WorkspaceProvider
- [x] Update `src/components/sidebar/sidebar.tsx` — workspace-aware DM creation
- [x] Test: workspace switch re-fetches conversations
- [x] Test: presence only shows users in active workspace
- [x] Compile check: `pnpm build` passes

## Success Criteria

- [x] WorkspaceProvider renders without error
- [x] Conversations filtered by active workspace
- [x] Presence scoped to active workspace
- [x] Workspace switch updates all data immediately
- [x] No TypeScript errors after type updates

## Next Steps

→ Phase 3 (Workspace Rail UI) + Phase 4 (Component Updates) can start in parallel
