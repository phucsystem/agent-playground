"use client";

export const AVATAR_COLORS = [
  "#7c8db5", "#8b7e9b", "#7ba69e", "#b0896d", "#9b8a7c",
  "#6d8fa8", "#a07e8f", "#8a9e7c", "#9c8fb0", "#7e9baa",
  "#a08e7a", "#8b9c8e", "#9a7e8d", "#7c93a6", "#a69880",
  "#8e8ca0", "#7da094", "#a88d7e", "#8c96a8", "#9a9080",
];

export function getWorkspaceColor(workspaceId: string): string {
  let hash = 0;
  for (let charIndex = 0; charIndex < workspaceId.length; charIndex++) {
    hash = workspaceId.charCodeAt(charIndex) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface WorkspaceAvatarProps {
  workspace: { id: string; name: string; avatar_url: string | null; color?: string | null };
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

  const bgColor = workspace.color || getWorkspaceColor(workspace.id);
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
