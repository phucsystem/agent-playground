"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { X } from "lucide-react";
import type { Workspace } from "@/types/database";

interface WorkspaceSettingsProps {
  workspace: Workspace;
  onClose: () => void;
  onSaved: () => void;
}

export function WorkspaceSettings({ workspace, onClose, onSaved }: WorkspaceSettingsProps) {
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description ?? "");
  const [avatarUrl, setAvatarUrl] = useState(workspace.avatar_url ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase
      .from("workspaces")
      .update({
        name: name.trim(),
        description: description.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      })
      .eq("id", workspace.id);

    setSaving(false);
    if (!error) {
      onSaved();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-neutral-800">Edit Workspace</h3>
          <button onClick={onClose} className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-primary-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Avatar URL</label>
            <input
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg font-mono focus:outline-none focus:border-primary-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-100 rounded-md transition cursor-pointer">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 rounded-md transition cursor-pointer"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
