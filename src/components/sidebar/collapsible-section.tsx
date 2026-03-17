"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  action,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="px-3 pt-3 pb-1">
      <div className="flex items-center">
        <button
          onClick={() => setOpen(!open)}
          className="flex-1 flex items-center gap-1.5 px-1 py-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400 hover:text-neutral-600 transition cursor-pointer"
        >
          <ChevronDown
            className={`w-3 h-3 transition-transform duration-150 ${open ? "" : "-rotate-90"}`}
          />
          {title}
          {count !== undefined && (
            <span className="text-neutral-300 ml-0.5 font-normal">({count})</span>
          )}
        </button>
        {action}
      </div>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}
