import { Bot } from "lucide-react";
import type { AgentHealthStatus } from "@/hooks/use-agent-health";

interface AvatarProps {
  displayName: string;
  avatarUrl?: string | null;
  isAgent?: boolean;
  size?: "sm" | "md" | "lg";
  showPresence?: boolean;
  isOnline?: boolean;
  healthStatus?: AgentHealthStatus;
}

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
};

const colors = [
  "bg-primary-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

const healthDotColors: Record<AgentHealthStatus, string> = {
  healthy: "bg-success",
  unhealthy: "bg-neutral-400",
  unknown: "bg-neutral-400",
};

function getColor(name: string) {
  let hash = 0;
  for (let charIdx = 0; charIdx < name.length; charIdx++) {
    hash = name.charCodeAt(charIdx) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Avatar({
  displayName,
  avatarUrl,
  isAgent = false,
  size = "sm",
  showPresence = false,
  isOnline = false,
  healthStatus,
}: AvatarProps) {
  const showHealthDot = isAgent && healthStatus;

  return (
    <div className={`relative inline-flex shrink-0 ${sizeClasses[size].split(" ").slice(0, 2).join(" ")}`}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          className={`${sizeClasses[size]} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} ${getColor(displayName)} rounded-full flex items-center justify-center font-bold text-white`}
        >
          {getInitials(displayName)}
        </div>
      )}

      {showHealthDot ? (
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${healthDotColors[healthStatus]}`}
          title={`Agent ${healthStatus}`}
        />
      ) : isAgent ? (
        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center border-2 border-white">
          <Bot className="w-2.5 h-2.5 text-white" />
        </span>
      ) : null}

      {showPresence && !isAgent && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
            isOnline ? "bg-success" : "bg-neutral-400"
          }`}
        />
      )}
    </div>
  );
}
