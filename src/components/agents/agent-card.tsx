"use client";

import { Avatar } from "@/components/ui/avatar";
import { AgentStatsDisplay } from "./agent-stats-display";
import type { AgentCatalogEntry, AgentStats } from "@/types/agent-discovery";
import type { AgentHealthStatus } from "@/hooks/use-agent-health";
import { CATEGORIES } from "./category-filter-bar";

interface AgentCardProps {
  agent: AgentCatalogEntry;
  stats?: AgentStats;
  healthStatus?: AgentHealthStatus;
  variant?: "default" | "featured";
  onClick: () => void;
}

export function AgentCard({ agent, stats, healthStatus, variant = "default", onClick }: AgentCardProps) {
  const isFeatured = variant === "featured";
  const categoryInfo = CATEGORIES.find((cat) => cat.value === agent.category);
  const visibleTags = agent.tags?.slice(0, 3) ?? [];
  const remainingTags = (agent.tags?.length ?? 0) - 3;

  return (
    <button
      onClick={onClick}
      className={`text-left w-full rounded-xl border transition cursor-pointer hover:shadow-md ${
        isFeatured
          ? "border-primary-200 bg-gradient-to-br from-primary-50 to-white p-5"
          : "border-neutral-200 bg-white p-4 hover:border-neutral-300"
      }`}
    >
      <div className="flex items-start gap-3">
        <Avatar
          displayName={agent.display_name}
          avatarUrl={agent.avatar_url}
          isAgent
          size={isFeatured ? "lg" : "md"}
          healthStatus={healthStatus}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-semibold text-neutral-800 truncate ${isFeatured ? "text-base" : "text-sm"}`}>
              {agent.display_name}
            </span>
          </div>
          {categoryInfo && (
            <div className="flex items-center gap-1 text-neutral-400 text-xs mt-0.5">
              {categoryInfo.icon}
              <span>{categoryInfo.label}</span>
            </div>
          )}
        </div>
      </div>

      {agent.description && (
        <p className={`mt-2.5 text-neutral-500 text-sm leading-relaxed ${isFeatured ? "" : "line-clamp-2"}`}>
          {agent.description}
        </p>
      )}

      {visibleTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5">
          {visibleTags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 bg-neutral-100 text-neutral-500 text-[11px] rounded-full">
              {tag}
            </span>
          ))}
          {remainingTags > 0 && (
            <span className="px-2 py-0.5 bg-neutral-100 text-neutral-400 text-[11px] rounded-full">
              +{remainingTags}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 pt-2.5 border-t border-neutral-100">
        <AgentStatsDisplay stats={stats} compact />
      </div>
    </button>
  );
}
