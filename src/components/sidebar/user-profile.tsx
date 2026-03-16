"use client";

import { Avatar } from "@/components/ui/avatar";
import { LogOut } from "lucide-react";
import type { User } from "@/types/database";

interface UserProfileProps {
  currentUser: User;
  onLogout: () => void;
}

export function UserProfile({ currentUser, onLogout }: UserProfileProps) {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-neutral-200">
      <Avatar
        displayName={currentUser.display_name}
        avatarUrl={currentUser.avatar_url}
        showPresence
        isOnline
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-neutral-800 truncate">
          {currentUser.display_name}
        </p>
        <p className="text-xs text-neutral-400 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-success inline-block" />
          Online
        </p>
      </div>
      <button
        onClick={onLogout}
        className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
        title="Logout"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
}
