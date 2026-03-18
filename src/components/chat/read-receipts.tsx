"use client";

import { Avatar } from "@/components/ui/avatar";
import type { ReadReceiptUser } from "@/hooks/use-read-receipts";

interface ReadReceiptsProps {
  readers: ReadReceiptUser[];
  isDm: boolean;
  isCurrentUserMessage: boolean;
}

export function ReadReceipts({ readers, isDm, isCurrentUserMessage }: ReadReceiptsProps) {
  if (readers.length === 0 || !isCurrentUserMessage) return null;

  if (isDm) {
    return (
      <div className="flex justify-end mt-0.5 mr-1">
        <span className="text-[10px] text-neutral-400">Seen</span>
      </div>
    );
  }

  const maxVisible = 4;
  const visibleReaders = readers.slice(0, maxVisible);
  const remaining = readers.length - maxVisible;
  const tooltip = readers.map((reader) => reader.displayName).join(", ");

  return (
    <div className="flex justify-end mt-0.5 mr-1" title={`Seen by ${tooltip}`}>
      <div className="flex -space-x-1.5">
        {visibleReaders.map((reader) => (
          <div key={reader.userId} className="w-4 h-4 rounded-full ring-1 ring-white overflow-hidden">
            <div className="w-4 h-4 scale-50 origin-top-left">
              <Avatar
                displayName={reader.displayName}
                avatarUrl={reader.avatarUrl}
                size="sm"
              />
            </div>
          </div>
        ))}
        {remaining > 0 && (
          <div className="w-4 h-4 rounded-full bg-neutral-300 ring-1 ring-white flex items-center justify-center">
            <span className="text-[7px] font-bold text-white">+{remaining}</span>
          </div>
        )}
      </div>
    </div>
  );
}
