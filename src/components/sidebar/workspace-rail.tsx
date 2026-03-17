"use client";

import { useState, useRef, useCallback } from "react";
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
  unreadByWorkspace?: Record<string, number>;
}

export function WorkspaceRail({ workspaces, activeWorkspaceId, onSwitch, isAdmin, unreadByWorkspace = {} }: WorkspaceRailProps) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="flex flex-col items-center w-[60px] h-full py-3 gap-2 overflow-y-auto">
      {workspaces.map((workspace) => {
        const isActive = workspace.id === activeWorkspaceId;
        const unreadCount = unreadByWorkspace[workspace.id] ?? 0;
        return (
          <WorkspaceRailItem
            key={workspace.id}
            workspace={workspace}
            isActive={isActive}
            onSwitch={onSwitch}
            unreadCount={unreadCount}
          />
        );
      })}

      {isAdmin && (
        <>
          <div className="w-6 border-t border-white/20 my-1" />
          <button
            onClick={() => setShowCreate(true)}
            className="w-10 h-10 rounded-full bg-white/10 text-white/60 hover:bg-white/20 hover:text-white flex items-center justify-center transition"
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

function WorkspaceRailItem({
  workspace,
  isActive,
  onSwitch,
  unreadCount = 0,
}: {
  workspace: Workspace;
  isActive: boolean;
  onSwitch: (workspaceId: string) => void;
  unreadCount?: number;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setTooltipPos({ top: rect.top + rect.height / 2, left: rect.right + 8 });
    }
    setShowTooltip(true);
  }, []);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => onSwitch(workspace.id)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowTooltip(false)}
        className={`relative rounded-full transition-all duration-200 cursor-pointer ${
          isActive
            ? "ring-2 ring-accent-300 ring-offset-2 ring-offset-[#312e81]"
            : "opacity-70 hover:opacity-100 hover:rounded-2xl"
        }`}
      >
        <WorkspaceAvatar workspace={workspace} size="md" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-error text-white text-[10px] font-bold rounded-full px-1 shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Active indicator bar */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[2px] w-1 h-5 bg-white rounded-r-full" />
      )}

      {/* Fixed-position tooltip (not clipped by parent overflow) */}
      {showTooltip && (
        <div
          className="fixed px-2.5 py-1 bg-neutral-900 text-white text-xs font-medium rounded-md whitespace-nowrap pointer-events-none z-[999] shadow-lg"
          style={{ top: tooltipPos.top, left: tooltipPos.left, transform: "translateY(-50%)" }}
        >
          {workspace.name}
        </div>
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
            className="w-full py-2.5 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 disabled:from-neutral-300 disabled:to-neutral-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all"
          >
            {creating ? "Creating..." : "Create Workspace"}
          </button>
        </div>
      </div>
    </div>
  );
}
