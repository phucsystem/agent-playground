"use client";

import { useState } from "react";
import { FileCode, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";

interface SnippetCardProps {
  title: string;
  content: string;
  lineCount: number;
}

const COLLAPSED_LINE_LIMIT = 8;

export function SnippetCard({ title, content, lineCount }: SnippetCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isCollapsible = lineCount > COLLAPSED_LINE_LIMIT;

  const displayContent = !expanded && isCollapsible
    ? content.split("\n").slice(0, COLLAPSED_LINE_LIMIT).join("\n")
    : content;

  function handleCopy() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden max-w-md mt-1 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-gradient-to-r from-accent-50/60 to-teal-50/40 border-b border-accent-100/50">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="w-4 h-4 text-accent-500 shrink-0" />
          <span className="text-[13px] font-semibold text-neutral-700 truncate">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-neutral-400 tabular-nums">{lineCount} lines</span>
          <button
            onClick={handleCopy}
            className="p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-md transition cursor-pointer"
            title="Copy snippet"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      <pre className="px-3.5 py-2.5 text-[13px] leading-relaxed text-neutral-600 overflow-x-auto whitespace-pre-wrap break-words font-mono bg-white">
        {displayContent}
      </pre>
      {isCollapsible && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-center gap-1 w-full py-2 text-[12px] font-medium text-accent-500 hover:text-accent-600 hover:bg-accent-50/50 border-t border-neutral-100 transition cursor-pointer"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Show all {lineCount} lines
            </>
          )}
        </button>
      )}
    </div>
  );
}
