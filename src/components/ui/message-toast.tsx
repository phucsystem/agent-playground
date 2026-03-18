"use client";

import { Avatar } from "./avatar";

interface MessageToastProps {
  senderName: string;
  avatarUrl: string | null;
  preview: string;
  conversationName?: string;
  isGroup?: boolean;
}

export function MessageToast({
  senderName,
  avatarUrl,
  preview,
  conversationName,
  isGroup,
}: MessageToastProps) {
  return (
    <div className="flex items-center gap-3 pl-0 pr-4 py-3 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-neutral-200/80 overflow-hidden w-[300px]">
      {/* Blue accent bar */}
      <div className="w-1 self-stretch bg-primary-400 rounded-r-full shrink-0" />

      <div className="relative shrink-0">
        <Avatar displayName={senderName} avatarUrl={avatarUrl} size="sm" />
      </div>

      <div className="flex flex-col min-w-0 flex-1 gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-neutral-800 truncate leading-tight">
            {senderName}
          </span>
          {isGroup && conversationName && (
            <span className="text-[11px] text-neutral-400 truncate">in {conversationName}</span>
          )}
        </div>
        <p className="text-[11px] text-neutral-500 truncate leading-tight">{preview}</p>
      </div>
    </div>
  );
}
