"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="px-2 pt-3 pb-0.5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1 px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 hover:text-neutral-500 transition cursor-pointer"
      >
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-150 ${open ? "" : "-rotate-90"}`}
        />
        {title}
        {count !== undefined && (
          <span className="text-neutral-300 ml-0.5 font-normal">({count})</span>
        )}
      </button>
      {open && <div className="mt-0.5">{children}</div>}
    </div>
  );
}
