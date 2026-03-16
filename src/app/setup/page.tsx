"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Bot, Loader2, RefreshCw } from "lucide-react";

const AVATAR_STYLES = [
  "adventurer",
  "avataaars",
  "bottts",
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

export default function SetupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("adventurer");
  const [seed, setSeed] = useState(() => crypto.randomUUID().slice(0, 8));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const avatarUrl = useMemo(
    () => generateAvatarUrl(selectedStyle, seed),
    [selectedStyle, seed]
  );

  const previewAvatars = useMemo(
    () => AVATAR_STYLES.map((style) => ({
      style,
      url: generateAvatarUrl(style, seed),
    })),
    [seed]
  );

  function randomizeSeed() {
    setSeed(crypto.randomUUID().slice(0, 8));
  }

  async function handleSave() {
    if (!displayName.trim()) return;
    setSaving(true);
    setError("");

    const supabase = createBrowserSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      setError("Session expired. Please log in again.");
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({
        display_name: displayName.trim(),
        avatar_url: avatarUrl,
      })
      .eq("id", session.user.id);

    if (updateError) {
      setError("Failed to save profile. Try again.");
      setSaving(false);
      return;
    }

    router.push("/chat");
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Bot className="w-6 h-6 text-primary-500" />
          <h1 className="text-xl font-bold text-neutral-900">
            Set up your profile
          </h1>
        </div>
        <p className="text-sm text-neutral-400 text-center mb-6">
          Choose a nickname and avatar
        </p>

        <div className="flex flex-col items-center gap-4 mb-6">
          <img
            src={avatarUrl}
            alt="Avatar preview"
            className="w-20 h-20 rounded-full bg-neutral-100 border-2 border-neutral-200"
          />
          <button
            onClick={randomizeSeed}
            className="flex items-center gap-1.5 text-sm text-primary-500 hover:text-primary-600 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Randomize
          </button>
        </div>

        <label className="block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wide">
          Nickname
        </label>
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="How others will see you"
          autoFocus
          className="w-full px-4 py-3 border border-neutral-200 rounded-lg text-base text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 transition mb-4"
        />

        <label className="block text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wide">
          Avatar style
        </label>
        <div className="grid grid-cols-6 gap-2 mb-6">
          {previewAvatars.map(({ style, url }) => (
            <button
              key={style}
              onClick={() => setSelectedStyle(style)}
              className={`p-1 rounded-lg border-2 transition ${
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

        {error && (
          <p className="text-sm text-error mb-3">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={!displayName.trim() || saving}
          className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            "Continue to Chat"
          )}
        </button>
      </div>
    </div>
  );
}
