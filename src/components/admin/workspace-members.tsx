"use client";

import { useState, useEffect } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import { toast } from "sonner";
import { X, UserPlus, Trash2 } from "lucide-react";
import type { User, Workspace } from "@/types/database";

interface WorkspaceMembersProps {
  workspace: Workspace;
  onClose: () => void;
}

interface MemberWithUser {
  user_id: string;
  user: Pick<User, "id" | "display_name" | "avatar_url" | "is_agent" | "role">;
}

export function WorkspaceMembers({ workspace, onClose }: WorkspaceMembersProps) {
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [nonMembers, setNonMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);

  async function fetchMembers() {
    const supabase = createBrowserSupabaseClient();

    const { data: memberData } = await supabase
      .from("workspace_members")
      .select("user_id, user:users!inner(id, display_name, avatar_url, is_agent, role)")
      .eq("workspace_id", workspace.id);

    if (memberData) {
      setMembers(memberData as unknown as MemberWithUser[]);
    }

    const { data: allUsers } = await supabase
      .from("users")
      .select("*")
      .eq("is_active", true)
      .order("display_name");

    if (allUsers && memberData) {
      const memberIds = new Set((memberData as unknown as MemberWithUser[]).map((member) => member.user_id));
      setNonMembers((allUsers as User[]).filter((appUser) => !memberIds.has(appUser.id)));
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchMembers();
  }, [workspace.id]);

  async function handleAddMember(userId: string) {
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.from("workspace_members").insert({
      workspace_id: workspace.id,
      user_id: userId,
    });
    if (error) {
      toast.error(`Failed to add member: ${error.message}`);
      return;
    }
    fetchMembers();
    setShowAddUser(false);
  }

  async function handleRemoveMember(userId: string) {
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase
      .from("workspace_members")
      .delete()
      .eq("workspace_id", workspace.id)
      .eq("user_id", userId);
    if (error) {
      toast.error(`Failed to remove member: ${error.message}`);
      return;
    }
    fetchMembers();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
          <h3 className="text-sm font-semibold text-neutral-800">
            Members — {workspace.name} ({members.length})
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddUser(!showAddUser)}
              className="p-1.5 rounded-md text-primary-500 hover:bg-primary-50 transition"
              title="Add member"
            >
              <UserPlus className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showAddUser && nonMembers.length > 0 && (
          <div className="px-5 py-3 border-b border-neutral-100 bg-neutral-50">
            <p className="text-xs font-medium text-neutral-500 mb-2 uppercase tracking-wide">Add user</p>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {nonMembers.map((appUser) => (
                <button
                  key={appUser.id}
                  onClick={() => handleAddMember(appUser.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white transition text-left"
                >
                  <Avatar displayName={appUser.display_name} avatarUrl={appUser.avatar_url} isAgent={appUser.is_agent} size="sm" />
                  <span className="text-sm text-neutral-700 truncate">{appUser.display_name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="px-5 py-8 text-center text-sm text-neutral-400">Loading...</div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {members.map((member) => (
                <div key={member.user_id} className="flex items-center gap-2 px-5 py-2.5">
                  <Avatar
                    displayName={member.user.display_name}
                    avatarUrl={member.user.avatar_url}
                    isAgent={member.user.is_agent}
                    size="sm"
                  />
                  <span className="text-sm text-neutral-700 flex-1 truncate">
                    {member.user.display_name}
                  </span>
                  {member.user.role === "admin" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-primary-100 text-primary-600">
                      admin
                    </span>
                  )}
                  <button
                    onClick={() => handleRemoveMember(member.user_id)}
                    className="p-1 rounded-md text-neutral-300 hover:text-red-500 hover:bg-red-50 transition"
                    title="Remove member"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
