"use client";

import { Avatar } from "./avatar";

interface PresenceToastProps {
  displayName: string;
  avatarUrl: string | null;
}

export function PresenceToast({ displayName, avatarUrl }: PresenceToastProps) {
  return (
    <div className="flex items-center gap-3 pl-0 pr-4 py-3 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-neutral-200/80 overflow-hidden w-[300px]">
      {/* Green accent bar */}
      <div className="w-1 self-stretch bg-emerald-400 rounded-r-full shrink-0" />

      {/* Avatar with presence dot */}
      <div className="relative shrink-0">
        <Avatar displayName={displayName} avatarUrl={avatarUrl} size="sm" showPresence isOnline />
      </div>

      {/* Text */}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[13px] font-semibold text-neutral-800 truncate leading-tight">
          {displayName}
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-[11px] text-emerald-600 font-medium">just came online</span>
        </div>
      </div>
    </div>
  );
}
