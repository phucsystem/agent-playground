"use client";

import {
  Pen,
  Code,
  Search,
  Database,
  Headphones,
  Palette,
  Settings,
  Bot,
  LayoutGrid,
} from "lucide-react";
import type { AgentCategory } from "@/types/database";

const CATEGORIES: { value: AgentCategory; label: string; icon: React.ReactNode }[] = [
  { value: "writing", label: "Writing", icon: <Pen className="w-3.5 h-3.5" /> },
  { value: "code", label: "Code", icon: <Code className="w-3.5 h-3.5" /> },
  { value: "research", label: "Research", icon: <Search className="w-3.5 h-3.5" /> },
  { value: "data", label: "Data", icon: <Database className="w-3.5 h-3.5" /> },
  { value: "support", label: "Support", icon: <Headphones className="w-3.5 h-3.5" /> },
  { value: "creative", label: "Creative", icon: <Palette className="w-3.5 h-3.5" /> },
  { value: "ops", label: "Ops", icon: <Settings className="w-3.5 h-3.5" /> },
  { value: "general", label: "General", icon: <Bot className="w-3.5 h-3.5" /> },
];

interface CategoryFilterBarProps {
  activeCategory: AgentCategory | undefined;
  onCategoryChange: (category: AgentCategory | undefined) => void;
}

export function CategoryFilterBar({ activeCategory, onCategoryChange }: CategoryFilterBarProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
      <button
        onClick={() => onCategoryChange(undefined)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer ${
          !activeCategory
            ? "bg-primary-600 text-white"
            : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
        }`}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        All
      </button>
      {CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          onClick={() => onCategoryChange(activeCategory === cat.value ? undefined : cat.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer ${
            activeCategory === cat.value
              ? "bg-primary-600 text-white"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
        >
          {cat.icon}
          {cat.label}
        </button>
      ))}
    </div>
  );
}

export { CATEGORIES };
