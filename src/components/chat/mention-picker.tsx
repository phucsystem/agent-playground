"use client";

import { useEffect, useRef } from "react";
import { Avatar } from "@/components/ui/avatar";
import type { User } from "@/types/database";

export interface MentionCandidate {
  id: string;
  display_name: string;
  avatar_url: string | null;
  is_agent: boolean;
}

interface MentionPickerProps {
  candidates: MentionCandidate[];
  selectedIndex: number;
  onSelect: (candidate: MentionCandidate) => void;
}

export function MentionPicker({ candidates, selectedIndex, onSelect }: MentionPickerProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selected = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (candidates.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-neutral-200 rounded-xl shadow-lg max-h-48 overflow-y-auto z-50"
    >
      {candidates.map((candidate, index) => (
        <button
          key={candidate.id}
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(candidate);
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition ${
            index === selectedIndex ? "bg-primary-50" : "hover:bg-neutral-50"
          }`}
        >
          <Avatar
            displayName={candidate.display_name}
            avatarUrl={candidate.avatar_url}
            isAgent={candidate.is_agent}
            size="sm"
          />
          <span className="text-sm text-neutral-700 truncate">{candidate.display_name}</span>
          {candidate.is_agent && (
            <span className="text-[10px] text-primary-500 font-semibold uppercase">agent</span>
          )}
        </button>
      ))}
    </div>
  );
}
