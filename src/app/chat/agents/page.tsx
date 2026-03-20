"use client";

import { useState, useMemo } from "react";
import { Search, Bot, Menu } from "lucide-react";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { useAgentCatalog } from "@/hooks/use-agent-catalog";
import { useAgentStats } from "@/hooks/use-agent-stats";
import { useAgentHealthContext } from "@/hooks/use-agent-health-context";
import { useMobileSidebar } from "@/hooks/use-mobile-sidebar";
import { AgentCard } from "@/components/agents/agent-card";
import { AgentDetailSheet } from "@/components/agents/agent-detail-sheet";
import { CategoryFilterBar } from "@/components/agents/category-filter-bar";
import { FeaturedAgents } from "@/components/agents/featured-agents";
import type { AgentCatalogEntry } from "@/types/agent-discovery";
import type { AgentCategory } from "@/types/database";

export default function AgentDiscoveryPage() {
  const { activeWorkspace } = useWorkspaceContext();
  const [selectedCategory, setSelectedCategory] = useState<AgentCategory | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<AgentCatalogEntry | null>(null);
  const { open: openSidebar } = useMobileSidebar();

  const { agents, featuredAgents, allAgents, isLoading } = useAgentCatalog(
    activeWorkspace?.id ?? null,
    { category: selectedCategory, search: searchQuery }
  );

  const agentUserIds = useMemo(
    () => allAgents.map((agent) => agent.user_id),
    [allAgents]
  );

  const { statsMap } = useAgentStats(agentUserIds);
  const { getStatus } = useAgentHealthContext();

  const nonFeaturedAgents = agents.filter((agent) => !agent.is_featured);
  const showFeatured = !selectedCategory && !searchQuery && featuredAgents.length > 0;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-3 border-b border-neutral-200 bg-white shrink-0">
        <button
          onClick={openSidebar}
          className="md:hidden p-1.5 text-neutral-400 hover:text-neutral-700 transition cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Bot className="w-5 h-5 text-primary-500" />
        <h1 className="text-base font-semibold text-neutral-800">Discover Agents</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search agents by name or description..."
            className="w-full pl-9 pr-4 py-2.5 bg-neutral-100 rounded-lg text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:bg-white focus:border focus:border-primary-300 transition"
          />
        </div>

        {/* Category filter */}
        <div className="mb-5">
          <CategoryFilterBar
            activeCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
        </div>

        {isLoading ? (
          <LoadingSkeleton />
        ) : allAgents.length === 0 ? (
          <EmptyState type="no-agents" />
        ) : agents.length === 0 ? (
          <EmptyState type="no-matches" />
        ) : (
          <>
            {showFeatured && (
              <FeaturedAgents
                agents={featuredAgents}
                statsMap={statsMap}
                getHealthStatus={getStatus}
                onSelectAgent={setSelectedAgent}
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(showFeatured ? nonFeaturedAgents : agents).map((agent) => (
                <AgentCard
                  key={agent.user_id}
                  agent={agent}
                  stats={statsMap.get(agent.user_id)}
                  healthStatus={getStatus(agent.user_id)}
                  onClick={() => setSelectedAgent(agent)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {selectedAgent && activeWorkspace && (
        <AgentDetailSheet
          agent={selectedAgent}
          stats={statsMap.get(selectedAgent.user_id)}
          healthStatus={getStatus(selectedAgent.user_id)}
          workspaceId={activeWorkspace.id}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-xl border border-neutral-200 p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-neutral-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-neutral-200 rounded w-24" />
              <div className="h-3 bg-neutral-100 rounded w-16" />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="h-3 bg-neutral-100 rounded w-full" />
            <div className="h-3 bg-neutral-100 rounded w-3/4" />
          </div>
          <div className="flex gap-1.5 mt-3">
            <div className="h-5 bg-neutral-100 rounded-full w-12" />
            <div className="h-5 bg-neutral-100 rounded-full w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ type }: { type: "no-agents" | "no-matches" }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Bot className="w-12 h-12 text-neutral-300 mb-3" />
      {type === "no-agents" ? (
        <>
          <p className="text-sm font-medium text-neutral-500">No agents in this workspace</p>
          <p className="text-xs text-neutral-400 mt-1">Ask an admin to add agents from the Admin Panel</p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-neutral-500">No agents match your search</p>
          <p className="text-xs text-neutral-400 mt-1">Try different keywords or clear filters</p>
        </>
      )}
    </div>
  );
}
