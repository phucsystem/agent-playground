"use client";

import { useState, useMemo } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { X, RefreshCw, Loader2 } from "lucide-react";
import type { User } from "@/types/database";

const AGENT_AVATAR_STYLES = [
  "bottts",
  "bottts-neutral",
  "glass",
  "identicon",
  "pixel-art",
  "rings",
  "shapes",
  "thumbs",
];

const USER_AVATAR_STYLES = [
  "adventurer",
  "avataaars",
  "fun-emoji",
  "lorelei",
  "micah",
  "miniavs",
  "notionists",
  "open-peeps",
  "personas",
  "pixel-art",
  "thumbs",
];

function generateAvatarUrl(style: string, seed: string) {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

function parseAvatarUrl(url: string | null, isAgent: boolean): { style: string; seed: string } {
  const fallbackStyle = isAgent ? "bottts" : "adventurer";
  if (!url) return { style: fallbackStyle, seed: crypto.randomUUID().slice(0, 8) };
  const match = url.match(/dicebear\.com\/[\d.]+x\/([^/]+)\/svg\?seed=([^&]+)/);
  if (match) return { style: match[1], seed: decodeURIComponent(match[2]) };
  return { style: fallbackStyle, seed: crypto.randomUUID().slice(0, 8) };
}

interface EditUserDialogProps {
  user: User;
  onClose: () => void;
  onSaved: () => void;
}

export function EditUserDialog({ user, onClose, onSaved }: EditUserDialogProps) {
  const avatarStyles = user.is_agent ? AGENT_AVATAR_STYLES : USER_AVATAR_STYLES;
  const parsed = useMemo(() => parseAvatarUrl(user.avatar_url, user.is_agent), [user.avatar_url, user.is_agent]);
  const [displayName, setDisplayName] = useState(user.display_name);
  const [selectedStyle, setSelectedStyle] = useState(parsed.style);
  const [seed, setSeed] = useState(parsed.seed);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const avatarUrl = useMemo(
    () => generateAvatarUrl(selectedStyle, seed),
    [selectedStyle, seed]
  );

  const previewAvatars = useMemo(
    () => avatarStyles.map((style) => ({
      style,
      url: generateAvatarUrl(style, seed),
    })),
    [seed, avatarStyles]
  );

  function randomizeSeed() {
    setSeed(crypto.randomUUID().slice(0, 8));
  }

  async function handleSave() {
    if (!displayName.trim()) return;
    setSaving(true);
    setError("");

    const supabase = createBrowserSupabaseClient();
    const { error: updateError } = await supabase
      .from("users")
      .update({
        display_name: displayName.trim(),
        avatar_url: avatarUrl,
      })
      .eq("id", user.id);

    if (updateError) {
      setError("Failed to save. Try again.");
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-neutral-900">Edit Profile</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3 mb-5">
          <img
            src={avatarUrl}
            alt="Avatar preview"
            className="w-20 h-20 rounded-full bg-neutral-100 border-2 border-neutral-200"
          />
          <button
            onClick={randomizeSeed}
            className="flex items-center gap-1.5 text-sm text-primary-500 hover:text-primary-600 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Randomize
          </button>
        </div>

        <label className="block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wide">
          Display Name
        </label>
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Enter display name"
          autoFocus
          className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 transition mb-4"
        />

        <label className="block text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wide">
          Avatar Style
        </label>
        <div className="grid grid-cols-6 gap-2 mb-5">
          {previewAvatars.map(({ style, url }) => (
            <button
              key={style}
              onClick={() => setSelectedStyle(style)}
              className={`p-1 rounded-lg border-2 transition cursor-pointer ${
                selectedStyle === style
                  ? "border-primary-500 bg-primary-50"
                  : "border-transparent hover:border-neutral-200"
              }`}
              title={style}
            >
              <img
                src={url}
                alt={style}
                className="w-full aspect-square rounded-md bg-neutral-50"
              />
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-error mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!displayName.trim() || saving}
            className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-neutral-500 hover:bg-neutral-100 rounded-lg transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
