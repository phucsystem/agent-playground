"use client";

import { MessageSquare, Menu } from "lucide-react";
import { useMobileSidebar } from "@/hooks/use-mobile-sidebar";

export default function ChatEmptyState() {
  const { open } = useMobileSidebar();

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 gap-3 px-4">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-100 via-accent-100 to-teal-100 flex items-center justify-center">
        <MessageSquare className="w-8 h-8 text-accent-400" />
      </div>
      <p className="text-lg font-medium text-neutral-500 text-center">
        Select a conversation to start chatting
      </p>
      <p className="text-sm text-neutral-400 text-center hidden md:block">
        Click on a user or conversation in the sidebar
      </p>
      <button
        onClick={open}
        className="md:hidden mt-2 flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-lg text-sm font-medium hover:from-primary-600 hover:to-accent-600 transition-all cursor-pointer"
      >
        <Menu className="w-4 h-4" />
        Open Conversations
      </button>
    </div>
  );
}
