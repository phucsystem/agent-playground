"use client";

import { useQuery } from "@tanstack/react-query";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { AgentStats } from "@/types/agent-discovery";

async function fetchAgentStats(agentIds: string[]): Promise<Map<string, AgentStats>> {
  const supabase = createBrowserSupabaseClient();

  const { data, error } = await supabase.rpc("get_agent_stats", {
    agent_ids: agentIds,
    days_back: 7,
  });

  const statsMap = new Map<string, AgentStats>();

  if (error || !data) return statsMap;

  for (const row of data as { agent_id: string; total_deliveries: number; successful_deliveries: number; avg_response_ms: number | null }[]) {
    const totalDeliveries = Number(row.total_deliveries);
    const successfulDeliveries = Number(row.successful_deliveries);
    statsMap.set(row.agent_id, {
      agent_id: row.agent_id,
      total_deliveries: totalDeliveries,
      successful_deliveries: successfulDeliveries,
      avg_response_ms: row.avg_response_ms ? Number(row.avg_response_ms) : null,
      uptime_pct: totalDeliveries > 0 ? Math.round((successfulDeliveries / totalDeliveries) * 100) : 0,
    });
  }

  return statsMap;
}

export function useAgentStats(agentIds: string[]) {
  const sortedIds = [...agentIds].sort();
  const queryKey = ["agent-stats", sortedIds.join(",")];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchAgentStats(sortedIds),
    enabled: sortedIds.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    statsMap: query.data ?? new Map<string, AgentStats>(),
    isLoading: query.isLoading,
    error: query.error,
  };
}
