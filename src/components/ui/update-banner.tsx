"use client";

import { RefreshCw, X } from "lucide-react";

interface UpdateBannerProps {
  version: string;
  onReload: () => void;
  onDismiss: () => void;
}

export function UpdateBanner({ version, onReload, onDismiss }: UpdateBannerProps) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-sky-50 border-b border-sky-200 text-sky-800 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <RefreshCw className="w-4 h-4 shrink-0" />
        <span className="truncate">
          A new version ({version}) is available.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onReload}
          className="px-3 py-1 rounded-md bg-sky-600 text-white text-xs font-medium hover:bg-sky-700 transition-colors cursor-pointer"
        >
          Refresh
        </button>
        <button
          onClick={onDismiss}
          className="p-1 rounded-md hover:bg-sky-100 transition-colors cursor-pointer"
          aria-label="Dismiss update notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
