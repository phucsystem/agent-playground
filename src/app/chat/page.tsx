"use client";

import { MessageSquare, Menu } from "lucide-react";
import { useMobileSidebar } from "@/hooks/use-mobile-sidebar";

export default function ChatEmptyState() {
  const { open } = useMobileSidebar();

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 gap-3 px-4">
      <MessageSquare className="w-12 h-12 opacity-40" />
      <p className="text-lg font-medium text-neutral-500 text-center">
        Select a conversation to start chatting
      </p>
      <p className="text-sm text-neutral-400 text-center hidden md:block">
        Click on a user or conversation in the sidebar
      </p>
      <button
        onClick={open}
        className="md:hidden mt-2 flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition cursor-pointer"
      >
        <Menu className="w-4 h-4" />
        Open Conversations
      </button>
    </div>
  );
}
