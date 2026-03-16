"use client";

import { useState, useEffect } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { X, Check } from "lucide-react";
import type { User } from "@/types/database";

interface CreateGroupDialogProps {
  currentUserId: string;
  onClose: () => void;
}

export function CreateGroupDialog({
  currentUserId,
  onClose,
}: CreateGroupDialogProps) {
  const router = useRouter();
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function fetchUsers() {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("is_active", true)
        .neq("id", currentUserId);
      if (data) setAllUsers(data as User[]);
    }
    fetchUsers();
  }, [currentUserId]);

  function toggleUser(userId: string) {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((selectedId) => selectedId !== userId)
        : [...prev, userId]
    );
  }

  async function handleCreate() {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    setCreating(true);

    const supabase = createBrowserSupabaseClient();

    const { data: conversation } = await supabase
      .from("conversations")
      .insert({
        type: "group",
        name: groupName.trim(),
        created_by: currentUserId,
      })
      .select()
      .single();

    if (!conversation) {
      setCreating(false);
      return;
    }

    const memberRows = [
      { conversation_id: conversation.id, user_id: currentUserId, role: "admin" },
      ...selectedUsers.map((userId) => ({
        conversation_id: conversation.id,
        user_id: userId,
        role: "member",
      })),
    ];

    await supabase.from("conversation_members").insert(memberRows);

    onClose();
    router.push(`/chat/${conversation.id}`);
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
          <h2 className="text-base font-semibold text-neutral-800">
            Create Group
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4">
          <label className="block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wide">
            Group Name
          </label>
          <input
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder="e.g. test-agents"
            autoFocus
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-primary-500"
          />
        </div>

        <div className="px-5 pb-2">
          <label className="block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wide">
            Add Members ({selectedUsers.length} selected)
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-1">
          {allUsers.map((appUser) => {
            const isSelected = selectedUsers.includes(appUser.id);
            return (
              <button
                key={appUser.id}
                onClick={() => toggleUser(appUser.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition text-left ${
                  isSelected ? "bg-primary-50 border border-primary-200" : "hover:bg-neutral-50 border border-transparent"
                }`}
              >
                <Avatar
                  displayName={appUser.display_name}
                  avatarUrl={appUser.avatar_url}
                  isAgent={appUser.is_agent}
                  size="sm"
                />
                <span className="text-sm text-neutral-700 flex-1">
                  {appUser.display_name}
                </span>
                {isSelected && <Check className="w-4 h-4 text-primary-500" />}
              </button>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t border-neutral-200">
          <button
            onClick={handleCreate}
            disabled={!groupName.trim() || selectedUsers.length === 0 || creating}
            className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition"
          >
            {creating ? "Creating..." : "Create Group"}
          </button>
        </div>
      </div>
    </div>
  );
}
