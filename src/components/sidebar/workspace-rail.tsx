"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { WorkspaceAvatar } from "@/components/ui/workspace-avatar";
import type { Workspace } from "@/types/database";

interface WorkspaceRailProps {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  onSwitch: (workspaceId: string) => void;
  isAdmin: boolean;
}

export function WorkspaceRail({ workspaces, activeWorkspaceId, onSwitch, isAdmin }: WorkspaceRailProps) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="flex flex-col items-center w-[60px] h-full py-3 gap-2 overflow-y-auto">
      {workspaces.map((workspace) => {
        const isActive = workspace.id === activeWorkspaceId;
        return (
          <div key={workspace.id} className="relative group">
            <button
              onClick={() => onSwitch(workspace.id)}
              className={`rounded-full transition-all duration-200 ${
                isActive
                  ? "ring-2 ring-primary-300 ring-offset-2 ring-offset-neutral-800"
                  : "hover:rounded-2xl"
              }`}
              title={workspace.name}
            >
              <WorkspaceAvatar workspace={workspace} size="md" />
            </button>

            {/* Tooltip */}
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-neutral-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
              {workspace.name}
            </div>

            {/* Active indicator bar */}
            {isActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[2px] w-1 h-5 bg-white rounded-r-full" />
            )}
          </div>
        );
      })}

      {isAdmin && (
        <>
          <div className="w-6 border-t border-neutral-600 my-1" />
          <button
            onClick={() => setShowCreate(true)}
            className="w-10 h-10 rounded-full bg-neutral-700 text-neutral-400 hover:bg-neutral-600 hover:text-white flex items-center justify-center transition"
            title="Create workspace"
          >
            <Plus className="w-5 h-5" />
          </button>
        </>
      )}

      {showCreate && (
        <CreateWorkspaceDialog onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}

function CreateWorkspaceDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const { refetchWorkspaces } = useWorkspaceContext();

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);

    const supabase = createBrowserSupabaseClient();
    const currentUserId = (await supabase.auth.getUser()).data.user?.id;

    const { data: newWorkspace, error } = await supabase
      .from("workspaces")
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        avatar_url: null,
        is_default: false,
        created_by: currentUserId,
      })
      .select("id")
      .single();

    if (error || !newWorkspace) {
      toast.error(`Failed to create workspace: ${error?.message ?? "Unknown error"}`);
      setCreating(false);
      return;
    }

    await supabase.from("workspace_members").insert({
      workspace_id: newWorkspace.id,
      user_id: currentUserId,
    });

    await refetchWorkspaces();
    setCreating(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
          <h2 className="text-base font-semibold text-neutral-800">Create Workspace</h2>
          <button onClick={onClose} className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wide">
              Workspace Name
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Team Alpha"
              autoFocus
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wide">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this workspace for?"
              rows={2}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-primary-500 resize-none"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-neutral-200">
          <button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition"
          >
            {creating ? "Creating..." : "Create Workspace"}
          </button>
        </div>
      </div>
    </div>
  );
}
