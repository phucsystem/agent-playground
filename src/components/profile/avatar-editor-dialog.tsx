"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { X, RefreshCw, Loader2, Upload, Sparkles } from "lucide-react";
import { getCroppedImage } from "@/lib/crop-image";
import { useAvatarUpload } from "@/hooks/use-avatar-upload";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { User } from "@/types/database";

const AVATAR_STYLES = [
  "adventurer", "avataaars", "bottts", "bottts-neutral", "fun-emoji", "glass",
  "identicon", "lorelei", "micah", "miniavs", "notionists", "open-peeps",
  "personas", "pixel-art", "rings", "shapes", "thumbs",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function generateAvatarUrl(style: string, seed: string) {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

interface AvatarEditorDialogProps {
  user: User;
  onClose: () => void;
  onSaved: () => void;
}

export function AvatarEditorDialog({ user, onClose, onSaved }: AvatarEditorDialogProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "generate">("upload");
  const { uploadAvatar, uploading } = useAvatarUpload();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Upload state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  // Generate state
  const [selectedStyle, setSelectedStyle] = useState("adventurer");
  const [seed, setSeed] = useState(() => crypto.randomUUID().slice(0, 8));

  useEffect(() => {
    return () => { if (imageSrc) URL.revokeObjectURL(imageSrc); };
  }, [imageSrc]);

  const diceBearUrl = useMemo(
    () => generateAvatarUrl(selectedStyle, seed),
    [selectedStyle, seed],
  );

  const previewAvatars = useMemo(
    () => AVATAR_STYLES.map((style) => ({ style, url: generateAvatarUrl(style, seed) })),
    [seed],
  );

  const onCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setError("File must be under 5MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    setError("");
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc(URL.createObjectURL(file));
  }

  async function handleSaveUpload() {
    if (!imageSrc || !croppedAreaPixels) return;
    setSaving(true);
    setError("");

    try {
      const blob = await getCroppedImage(imageSrc, croppedAreaPixels);
      await uploadAvatar(blob, user.id);
      onSaved();
      onClose();
    } catch {
      setError("Failed to upload avatar. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveGenerate() {
    setSaving(true);
    setError("");

    try {
      const supabase = createBrowserSupabaseClient();
      const { error: updateError } = await supabase
        .from("users")
        .update({ avatar_url: diceBearUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;
      onSaved();
      onClose();
    } catch {
      setError("Failed to save avatar. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const isBusy = saving || uploading;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-0">
          <h2 className="text-lg font-bold text-neutral-900">Edit Avatar</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-4">
          <button
            onClick={() => setActiveTab("upload")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition cursor-pointer ${
              activeTab === "upload"
                ? "bg-primary-100 text-primary-600"
                : "text-neutral-500 hover:bg-neutral-100"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Photo
          </button>
          <button
            onClick={() => setActiveTab("generate")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition cursor-pointer ${
              activeTab === "generate"
                ? "bg-primary-100 text-primary-600"
                : "text-neutral-500 hover:bg-neutral-100"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Generate
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {activeTab === "upload" && (
            <div>
              {imageSrc ? (
                <div>
                  <div className="relative w-full h-64 bg-neutral-900 rounded-lg overflow-hidden mb-3">
                    <Cropper
                      image={imageSrc}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      cropShape="round"
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropComplete={onCropComplete}
                    />
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs text-neutral-400 shrink-0">Zoom</span>
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.1}
                      value={zoom}
                      onChange={(event) => setZoom(Number(event.target.value))}
                      className="flex-1 accent-primary-500"
                    />
                  </div>
                  <button
                    onClick={() => { if (imageSrc) URL.revokeObjectURL(imageSrc); setImageSrc(null); setCrop({ x: 0, y: 0 }); setZoom(1); }}
                    className="text-sm text-neutral-500 hover:text-neutral-700 transition cursor-pointer"
                  >
                    Choose different image
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-neutral-300 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 transition">
                  <Upload className="w-8 h-8 text-neutral-400 mb-2" />
                  <span className="text-sm text-neutral-500">Click to choose an image</span>
                  <span className="text-xs text-neutral-400 mt-1">JPEG, PNG, GIF, WebP — max 5MB</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          )}

          {activeTab === "generate" && (
            <div>
              <div className="flex flex-col items-center gap-3 mb-4">
                <img
                  src={diceBearUrl}
                  alt="Avatar preview"
                  className="w-20 h-20 rounded-full bg-neutral-100 border-2 border-neutral-200"
                />
                <button
                  onClick={() => setSeed(crypto.randomUUID().slice(0, 8))}
                  className="flex items-center gap-1.5 text-sm text-primary-500 hover:text-primary-600 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Randomize
                </button>
              </div>
              <div className="grid grid-cols-6 gap-2">
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
                    <img src={url} alt={style} className="w-full aspect-square rounded-md bg-neutral-50" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-error mt-3">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={activeTab === "upload" ? handleSaveUpload : handleSaveGenerate}
            disabled={isBusy || (activeTab === "upload" && !imageSrc)}
            className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
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
