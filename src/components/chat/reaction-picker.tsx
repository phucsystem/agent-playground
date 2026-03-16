"use client";

import { useState } from "react";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "🤔", "👀"];

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
}

export function ReactionPicker({ onSelect }: ReactionPickerProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setVisible(!visible)}
        className="w-7 h-7 flex items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-red-500 text-sm"
        title="React"
      >
        ❤️
      </button>

      {visible && (
        <div className="absolute bottom-full right-0 mb-1 bg-white border border-neutral-200 rounded-xl shadow-lg p-1.5 flex gap-0.5 z-50">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onSelect(emoji);
                setVisible(false);
              }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-100 transition text-lg"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
