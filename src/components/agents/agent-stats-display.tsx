"use client";

import type { AgentStats } from "@/types/agent-discovery";

function formatResponseTime(ms: number | null): string {
  if (ms === null) return "\u2014";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatMessageCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

interface AgentStatsDisplayProps {
  stats: AgentStats | undefined;
  compact?: boolean;
}

export function AgentStatsDisplay({ stats, compact = false }: AgentStatsDisplayProps) {
  if (!stats) {
    return (
      <div className={`flex items-center gap-3 text-neutral-400 ${compact ? "text-[11px]" : "text-xs"}`}>
        <span>No activity yet</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${compact ? "text-[11px]" : "text-xs"}`}>
      <span className="flex items-center gap-1 text-amber-600" title="Avg response time">
        <span>&#9889;</span>
        {formatResponseTime(stats.avg_response_ms)}
      </span>
      <span className="flex items-center gap-1 text-emerald-600" title="Uptime">
        <span>&#10003;</span>
        {stats.uptime_pct}%
      </span>
      <span className="flex items-center gap-1 text-primary-600" title="Messages handled (7d)">
        <span>&#9993;</span>
        {formatMessageCount(stats.total_deliveries)}
      </span>
    </div>
  );
}
