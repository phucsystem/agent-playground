"use client";

import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";

interface ConfirmDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteDialog({ open, onClose, onConfirm }: ConfirmDeleteDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900">Delete message</h3>
        </div>
        <p className="text-sm text-neutral-500 mb-5">
          Are you sure you want to delete this message? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
