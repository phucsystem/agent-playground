"use client";

import { Sparkles } from "lucide-react";
import { AgentCard } from "./agent-card";
import type { AgentCatalogEntry, AgentStats } from "@/types/agent-discovery";
import type { AgentHealthStatus } from "@/hooks/use-agent-health";

interface FeaturedAgentsProps {
  agents: AgentCatalogEntry[];
  statsMap: Map<string, AgentStats>;
  getHealthStatus: (agentId: string) => AgentHealthStatus;
  onSelectAgent: (agent: AgentCatalogEntry) => void;
}

export function FeaturedAgents({ agents, statsMap, getHealthStatus, onSelectAgent }: FeaturedAgentsProps) {
  const featured = agents.slice(0, 3);
  if (featured.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <h2 className="text-sm font-semibold text-neutral-700">Featured</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {featured.map((agent) => (
          <AgentCard
            key={agent.user_id}
            agent={agent}
            stats={statsMap.get(agent.user_id)}
            healthStatus={getHealthStatus(agent.user_id)}
            variant="featured"
            onClick={() => onSelectAgent(agent)}
          />
        ))}
      </div>
    </div>
  );
}
