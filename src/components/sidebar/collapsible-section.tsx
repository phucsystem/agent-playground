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
    <div className="px-3 pt-3 pb-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 hover:text-accent-600 transition cursor-pointer"
      >
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-150 ${open ? "" : "-rotate-90"}`}
        />
        {title}
        {count !== undefined && (
          <span className="text-neutral-300 ml-0.5 font-normal">({count})</span>
        )}
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}
