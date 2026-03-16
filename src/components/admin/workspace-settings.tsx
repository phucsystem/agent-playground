"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { X } from "lucide-react";
import { WorkspaceAvatar, AVATAR_COLORS, getWorkspaceColor } from "@/components/ui/workspace-avatar";
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
  const [selectedColor, setSelectedColor] = useState(workspace.color ?? "");
  const [saving, setSaving] = useState(false);

  const defaultColor = getWorkspaceColor(workspace.id);

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
        color: selectedColor || null,
      })
      .eq("id", workspace.id);

    setSaving(false);
    if (!error) {
      onSaved();
      onClose();
    }
  }

  const previewWorkspace = {
    id: workspace.id,
    name: name || workspace.name,
    avatar_url: avatarUrl.trim() || null,
    color: selectedColor || null,
  };

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
          {/* Avatar preview */}
          <div className="flex items-center gap-3">
            <WorkspaceAvatar workspace={previewWorkspace} size="lg" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-700 truncate">{name || "Workspace"}</p>
              <p className="text-xs text-neutral-400">
                {avatarUrl.trim() ? "Custom image" : "Letter avatar"}
              </p>
            </div>
          </div>

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

          {/* Color picker */}
          {!avatarUrl.trim() && (
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">Avatar Color</label>
              <div className="flex flex-wrap gap-1.5">
                {AVATAR_COLORS.map((color) => {
                  const isSelected = selectedColor === color;
                  const isDefault = !selectedColor && color === defaultColor;
                  return (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color === defaultColor && !selectedColor ? "" : color)}
                      className={`w-7 h-7 rounded-full transition-all cursor-pointer ${
                        isSelected || isDefault
                          ? "ring-2 ring-offset-1 ring-neutral-800 scale-110"
                          : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: color }}
                      title={isDefault ? `${color} (default)` : color}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">
              Image URL <span className="text-neutral-300 font-normal">(optional, overrides color)</span>
            </label>
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
