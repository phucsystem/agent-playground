"use client";

import { useQuery } from "@tanstack/react-query";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { AgentCatalogEntry, CatalogFilters } from "@/types/agent-discovery";
import type { AgentCategory } from "@/types/database";

async function fetchAgentCatalog(workspaceId: string): Promise<AgentCatalogEntry[]> {
  const supabase = createBrowserSupabaseClient();

  // Fetch agent users from workspace (users table has permissive read RLS)
  const { data: memberData, error: memberError } = await supabase
    .from("workspace_members")
    .select(`
      user:users!inner(
        id,
        display_name,
        avatar_url,
        is_agent,
        is_active
      )
    `)
    .eq("workspace_id", workspaceId);

  if (memberError || !memberData) return [];

  const agentUsers = (memberData as unknown as { user: { id: string; display_name: string; avatar_url: string | null; is_agent: boolean; is_active: boolean } }[])
    .map((row) => row.user)
    .filter((user) => user.is_agent && user.is_active);

  if (agentUsers.length === 0) return [];

  // Use RPC to fetch agent configs (bypasses RLS, returns only safe fields)
  const { data: configs, error: configError } = await supabase.rpc("get_agent_catalog", {
    ws_id: workspaceId,
  });

  const configMap = new Map<string, {
    config_id: string;
    user_id: string;
    is_webhook_active: boolean;
    health_check_url: string | null;
    description: string | null;
    tags: string[] | null;
    category: string | null;
    sample_prompts: string[] | null;
    is_featured: boolean;
  }>();

  if (!configError && configs) {
    for (const config of configs) {
      configMap.set(config.user_id, config);
    }
  }

  const entries: AgentCatalogEntry[] = agentUsers.map((user) => {
    const config = configMap.get(user.id);
    return {
      id: config?.config_id ?? user.id,
      user_id: user.id,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      description: config?.description ?? null,
      tags: config?.tags ?? null,
      category: (config?.category as AgentCategory) ?? null,
      sample_prompts: config?.sample_prompts ?? null,
      is_featured: config?.is_featured ?? false,
      is_webhook_active: config?.is_webhook_active ?? false,
      health_check_url: config?.health_check_url ?? null,
    };
  });

  entries.sort((entryA, entryB) => {
    if (entryA.is_featured !== entryB.is_featured) return entryA.is_featured ? -1 : 1;
    return entryA.display_name.localeCompare(entryB.display_name);
  });

  return entries;
}

function filterCatalog(entries: AgentCatalogEntry[], filters: CatalogFilters): AgentCatalogEntry[] {
  let result = entries;

  if (filters.category) {
    result = result.filter((entry) => entry.category === filters.category);
  }

  if (filters.search) {
    const query = filters.search.toLowerCase();
    result = result.filter(
      (entry) =>
        entry.display_name.toLowerCase().includes(query) ||
        (entry.description?.toLowerCase().includes(query) ?? false)
    );
  }

  return result;
}

export function useAgentCatalog(workspaceId: string | null, filters: CatalogFilters = {}) {
  const query = useQuery({
    queryKey: ["agent-catalog", workspaceId],
    queryFn: () => fetchAgentCatalog(workspaceId!),
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const filtered = query.data ? filterCatalog(query.data, filters) : [];
  const featured = query.data?.filter((entry) => entry.is_featured) ?? [];

  return {
    ...query,
    agents: filtered,
    allAgents: query.data ?? [],
    featuredAgents: featured,
  };
}
