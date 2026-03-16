"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Workspace } from "@/types/database";

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  switchWorkspace: (workspaceId: string) => void;
  loading: boolean;
  refetchWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspaces: [],
  activeWorkspace: null,
  switchWorkspace: () => {},
  loading: true,
  refetchWorkspaces: async () => {},
});

export function useWorkspaceContext() {
  return useContext(WorkspaceContext);
}

export function WorkspaceProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase
      .from("workspace_members")
      .select("workspace:workspaces(*)")
      .eq("user_id", userId);

    const workspaceList: Workspace[] = (data ?? [])
      .map((row: Record<string, unknown>) => row.workspace as Workspace)
      .filter(Boolean);
    setWorkspaces(workspaceList);

    const stored = localStorage.getItem(`active_workspace_${userId}`);
    const storedExists = workspaceList.some((workspace) => workspace.id === stored);

    if (stored && storedExists) {
      setActiveWorkspaceId(stored);
    } else {
      const defaultWorkspace = workspaceList.find((workspace) => workspace.is_default) ?? workspaceList[0];
      if (defaultWorkspace) {
        setActiveWorkspaceId(defaultWorkspace.id);
        localStorage.setItem(`active_workspace_${userId}`, defaultWorkspace.id);
      }
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const switchWorkspace = useCallback((workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
    localStorage.setItem(`active_workspace_${userId}`, workspaceId);
  }, [userId]);

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;

  return (
    <WorkspaceContext.Provider value={{ workspaces, activeWorkspace, switchWorkspace, loading, refetchWorkspaces: fetchWorkspaces }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
