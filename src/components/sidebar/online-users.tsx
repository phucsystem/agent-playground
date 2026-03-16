"use client";

import { Avatar } from "@/components/ui/avatar";

interface OnlineUser {
  user_id: string;
  display_name: string;
  is_agent: boolean;
  avatar_url: string | null;
}

interface OnlineUsersProps {
  users: OnlineUser[];
  onClickUser: (userId: string) => void;
}

export function OnlineUsers({ users, onClickUser }: OnlineUsersProps) {
  if (users.length === 0) return null;

  return (
    <div className="px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 px-2 mb-1">
        Online ({users.length})
      </p>
      {users.map((onlineUser) => (
        <button
          key={onlineUser.user_id}
          onClick={() => onClickUser(onlineUser.user_id)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-100 transition text-left"
        >
          <Avatar
            displayName={onlineUser.display_name}
            avatarUrl={onlineUser.avatar_url}
            isAgent={onlineUser.is_agent}
            size="sm"
            showPresence
            isOnline
          />
          <span className="text-sm text-neutral-700 truncate">
            {onlineUser.display_name}
          </span>
        </button>
      ))}
    </div>
  );
}
