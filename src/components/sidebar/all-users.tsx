"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import { CollapsibleSection } from "./collapsible-section";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import type { User } from "@/types/database";

interface AllUsersProps {
  currentUserId: string;
  onlineUserIds: string[];
  onClickUser: (userId: string) => void;
}

export function AllUsers({ currentUserId, onlineUserIds, onClickUser }: AllUsersProps) {
  const [users, setUsers] = useState<User[]>([]);
  const { activeWorkspace } = useWorkspaceContext();

  useEffect(() => {
    async function fetchUsers() {
      const supabase = createBrowserSupabaseClient();

      if (activeWorkspace) {
        const { data } = await supabase
          .from("workspace_members")
          .select("user:users!inner(id, display_name, avatar_url, is_agent, last_seen_at, role, is_active)")
          .eq("workspace_id", activeWorkspace.id)
          .neq("user_id", currentUserId);

        if (data) {
          const workspaceUsers = (data as unknown as { user: User }[])
            .map((row) => row.user)
            .filter((appUser) => appUser.is_active)
            .sort((a, b) => a.display_name.localeCompare(b.display_name));
          setUsers(workspaceUsers);
        }
      } else {
        const { data } = await supabase
          .from("users_public")
          .select("*")
          .eq("is_active", true)
          .neq("id", currentUserId)
          .order("display_name");
        if (data) setUsers(data as User[]);
      }
    }
    fetchUsers();
  }, [currentUserId, activeWorkspace]);

  if (users.length === 0) return null;

  return (
    <CollapsibleSection title="Users" count={users.length} defaultOpen={false}>
      {users.map((appUser) => {
        const isOnline = onlineUserIds.includes(appUser.id);
        return (
          <button
            key={appUser.id}
            onClick={() => onClickUser(appUser.id)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-200/60 transition text-left"
          >
            <Avatar
              displayName={appUser.display_name}
              avatarUrl={appUser.avatar_url}
              isAgent={appUser.is_agent}
              size="sm"
            />
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                isOnline ? "bg-success" : "bg-neutral-300"
              }`}
            />
            <span className="text-sm text-neutral-700 truncate">
              {appUser.display_name}
            </span>
          </button>
        );
      })}
    </CollapsibleSection>
  );
}
