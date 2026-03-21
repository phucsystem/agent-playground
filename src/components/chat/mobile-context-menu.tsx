"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, Copy, Pencil, Trash2 } from "lucide-react";

const QUICK_EMOJIS = ["❤️", "👍", "😂", "😮", "🙏"];

interface MobileContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onReaction: (emoji: string) => void;
  onReply?: () => void;
  onCopy: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit: boolean;
  canDelete: boolean;
}

export function MobileContextMenu({
  isOpen,
  position,
  onClose,
  onReaction,
  onReply,
  onCopy,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: MobileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: TouchEvent | MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const menuHeight = 200;
  const menuWidth = 200;
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  let top = position.y - 10;
  let left = position.x - menuWidth / 2;

  if (top + menuHeight > viewportHeight - 20) {
    top = position.y - menuHeight - 10;
  }
  if (top < 10) top = 10;
  if (left < 10) left = 10;
  if (left + menuWidth > viewportWidth - 10) {
    left = viewportWidth - menuWidth - 10;
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} />
      <div
        ref={menuRef}
        className="fixed z-50 bg-white rounded-xl shadow-xl border border-neutral-100 py-1.5 w-[200px] animate-in fade-in zoom-in-95 duration-150"
        style={{ top, left }}
      >
        {/* Quick emoji bar */}
        <div className="flex items-center gap-1 px-2 pb-2 border-b border-neutral-100">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => { onReaction(emoji); onClose(); }}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 active:bg-neutral-200 transition text-base cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Action items */}
        <div className="py-1">
          {onReply && (
            <button
              onClick={() => { onReply(); onClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100 transition cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-neutral-400" />
              Reply
            </button>
          )}

          <button
            onClick={() => { onCopy(); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100 transition cursor-pointer"
          >
            <Copy className="w-4 h-4 text-neutral-400" />
            Copy
          </button>

          {canEdit && onEdit && (
            <button
              onClick={() => { onEdit(); onClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100 transition cursor-pointer"
            >
              <Pencil className="w-4 h-4 text-neutral-400" />
              Edit
            </button>
          )}

          {canDelete && onDelete && (
            <button
              onClick={() => { onDelete(); onClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-error hover:bg-red-50 active:bg-red-100 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
