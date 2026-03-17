"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, FileCode } from "lucide-react";

interface SnippetModalProps {
  onSubmit: (title: string, content: string) => void;
  onClose: () => void;
  initialContent?: string;
}

export function SnippetModal({ onSubmit, onClose, initialContent = "" }: SnippetModalProps) {
  const [title, setTitle] = useState("");
  const [snippetContent, setSnippetContent] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  function handleSubmit() {
    const trimmed = snippetContent.trim();
    if (!trimmed) return;
    onSubmit(title.trim() || "Untitled snippet", trimmed);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      handleSubmit();
    }
  }

  const lineCount = snippetContent.split("\n").length;
  const isSendable = snippetContent.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-neutral-100"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-neutral-500" />
            <h3 className="text-sm font-semibold text-neutral-800">Create text snippet</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-4 pb-5 space-y-3">
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Snippet title (optional)"
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-neutral-200 rounded-xl outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-50 transition placeholder:text-neutral-400"
          />

          <div className="relative">
            <textarea
              ref={textareaRef}
              value={snippetContent}
              onChange={(event) => setSnippetContent(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste or type your text here..."
              rows={10}
              className="w-full px-3.5 py-3 text-[13px] font-mono bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-50 transition resize-none placeholder:text-neutral-400 leading-relaxed"
            />
            {snippetContent.length > 0 && (
              <span className="absolute bottom-3 right-3 text-[11px] text-neutral-400 bg-neutral-50 px-1">
                {lineCount} {lineCount === 1 ? "line" : "lines"}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-neutral-100 bg-neutral-50/60">
          <span className="text-[11px] text-neutral-400">
            {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+Enter to send
          </span>
          <button
            onClick={handleSubmit}
            disabled={!isSendable}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl transition cursor-pointer ${
              isSendable
                ? "bg-primary-500 hover:bg-primary-600 text-white shadow-sm"
                : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            Send snippet
          </button>
        </div>
      </div>
    </div>
  );
}
