"use client";

import { Avatar } from "./avatar";
import type { AgentHealthStatus } from "@/hooks/use-agent-health";

interface AgentHealthToastProps {
  displayName: string;
  avatarUrl: string | null;
  status: AgentHealthStatus;
}

export function AgentHealthToast({ displayName, avatarUrl, status }: AgentHealthToastProps) {
  const isHealthy = status === "healthy";

  return (
    <div
      className={`flex items-center gap-3 pl-0 pr-4 py-3 backdrop-blur-sm rounded-xl shadow-lg border overflow-hidden w-[300px] ${
        isHealthy
          ? "bg-white/95 border-neutral-200/80"
          : "bg-white/95 border-neutral-200/80"
      }`}
    >
      {/* Status accent bar */}
      <div
        className={`w-1 self-stretch rounded-r-full shrink-0 ${
          isHealthy ? "bg-emerald-400" : "bg-rose-400"
        }`}
      />

      {/* Agent avatar */}
      <div className="relative shrink-0">
        <Avatar displayName={displayName} avatarUrl={avatarUrl} isAgent healthStatus={status} />
      </div>

      {/* Text */}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[13px] font-semibold text-neutral-800 truncate leading-tight">
          {displayName}
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          {isHealthy ? (
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-[11px] text-emerald-600 font-medium">agent is online</span>
            </>
          ) : (
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
              <span className="text-[11px] text-rose-500 font-medium">agent went offline</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
