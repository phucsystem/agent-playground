"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Avatar } from "@/components/ui/avatar";
import { AgentStatsDisplay } from "./agent-stats-display";
import { CATEGORIES } from "./category-filter-bar";
import type { AgentCatalogEntry, AgentStats } from "@/types/agent-discovery";
import type { AgentHealthStatus } from "@/hooks/use-agent-health";

interface AgentHoverCardProps {
  agent: AgentCatalogEntry | undefined;
  stats?: AgentStats;
  healthStatus?: AgentHealthStatus;
  children: React.ReactNode;
}

export function AgentHoverCard({ agent, stats, healthStatus, children }: AgentHoverCardProps) {
  const [visible, setVisible] = useState(false);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    enterTimerRef.current = setTimeout(() => setVisible(true), 300);
  }, []);

  const hide = useCallback(() => {
    if (enterTimerRef.current) {
      clearTimeout(enterTimerRef.current);
      enterTimerRef.current = null;
    }
    leaveTimerRef.current = setTimeout(() => setVisible(false), 100);
  }, []);

  useEffect(() => {
    return () => {
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, []);

  if (!agent) return <>{children}</>;

  const categoryInfo = CATEGORIES.find((cat) => cat.value === agent.category);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {visible && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-white rounded-xl border border-neutral-200 shadow-lg p-3 pointer-events-auto animate-in fade-in zoom-in-95 duration-150"
          onMouseEnter={show}
          onMouseLeave={hide}
        >
          <div className="flex items-center gap-2.5">
            <Avatar
              displayName={agent.display_name}
              avatarUrl={agent.avatar_url}
              isAgent
              size="md"
              healthStatus={healthStatus}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-800 truncate">{agent.display_name}</p>
              <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                {categoryInfo && (
                  <>
                    {categoryInfo.icon}
                    <span>{categoryInfo.label}</span>
                    <span className="mx-0.5">·</span>
                  </>
                )}
                <span className={healthStatus === "healthy" ? "text-emerald-500" : "text-neutral-400"}>
                  {healthStatus === "healthy" ? "Online" : "Offline"}
                </span>
              </div>
            </div>
          </div>
          {agent.description && (
            <p className="text-xs text-neutral-500 mt-2 line-clamp-2 leading-relaxed">{agent.description}</p>
          )}
          <div className="mt-2 pt-2 border-t border-neutral-100">
            <AgentStatsDisplay stats={stats} compact />
          </div>
        </div>
      )}
    </div>
  );
}
