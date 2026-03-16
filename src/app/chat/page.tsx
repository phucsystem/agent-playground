import { MessageSquare } from "lucide-react";

export default function ChatEmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 gap-3">
      <MessageSquare className="w-12 h-12 opacity-40" />
      <p className="text-lg font-medium text-neutral-500">
        Select a conversation to start chatting
      </p>
      <p className="text-sm text-neutral-400">
        Click on a user or conversation in the sidebar
      </p>
    </div>
  );
}
