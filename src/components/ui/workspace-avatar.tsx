"use client";

const AVATAR_COLORS = [
  "#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#1abc9c",
  "#3498db", "#9b59b6", "#e84393", "#00b894", "#6c5ce7",
  "#fd79a8", "#0984e3", "#00cec9", "#d63031", "#a29bfe",
  "#fab1a0", "#55efc4", "#74b9ff", "#dfe6e9", "#636e72",
];

export function getWorkspaceColor(workspaceId: string): string {
  let hash = 0;
  for (let charIndex = 0; charIndex < workspaceId.length; charIndex++) {
    hash = workspaceId.charCodeAt(charIndex) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface WorkspaceAvatarProps {
  workspace: { id: string; name: string; avatar_url: string | null };
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
};

export function WorkspaceAvatar({ workspace, size = "md", className = "" }: WorkspaceAvatarProps) {
  const sizeClass = SIZE_MAP[size];

  if (workspace.avatar_url) {
    return (
      <img
        src={workspace.avatar_url}
        alt={workspace.name}
        className={`${sizeClass} rounded-full object-cover ${className}`}
      />
    );
  }

  const bgColor = getWorkspaceColor(workspace.id);
  const letter = workspace.name.charAt(0).toUpperCase();

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-white shrink-0 ${className}`}
      style={{ backgroundColor: bgColor }}
    >
      {letter}
    </div>
  );
}
