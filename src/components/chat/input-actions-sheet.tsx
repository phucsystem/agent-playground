"use client";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Paperclip, Smile, ImageIcon, FileCode } from "lucide-react";

interface InputActionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAttachFile: () => void;
  onOpenEmoji: () => void;
  onOpenGif: () => void;
  onOpenSnippet: () => void;
}

const actions = [
  { key: "file", icon: Paperclip, label: "File", color: "bg-primary-50 text-primary-500" },
  { key: "emoji", icon: Smile, label: "Emoji", color: "bg-amber-50 text-amber-500" },
  { key: "gif", icon: ImageIcon, label: "GIF", color: "bg-violet-50 text-violet-500" },
  { key: "snippet", icon: FileCode, label: "Snippet", color: "bg-emerald-50 text-emerald-500" },
] as const;

export function InputActionsSheet({
  isOpen,
  onClose,
  onAttachFile,
  onOpenEmoji,
  onOpenGif,
  onOpenSnippet,
}: InputActionsSheetProps) {
  const handlers: Record<string, () => void> = {
    file: onAttachFile,
    emoji: onOpenEmoji,
    gif: onOpenGif,
    snippet: onOpenSnippet,
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} snapPoints={[0.3]} title="Actions">
      <div className="grid grid-cols-4 gap-2 px-4 pb-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.key}
              onClick={() => {
                handlers[action.key]();
                onClose();
              }}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl hover:bg-neutral-50 active:bg-neutral-100 transition cursor-pointer"
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${action.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[11px] text-neutral-600 font-medium">{action.label}</span>
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
