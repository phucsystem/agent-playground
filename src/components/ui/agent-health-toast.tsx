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
    <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-lg shadow-lg border border-neutral-200">
      <Avatar displayName={displayName} avatarUrl={avatarUrl} isAgent healthStatus={status} />
      <div className="flex flex-col">
        <span className="text-sm font-medium text-neutral-800">
          {displayName}
        </span>
        <span className="text-xs text-neutral-500">
          {isHealthy ? "is now available" : "is unavailable"}
        </span>
      </div>
    </div>
  );
}
