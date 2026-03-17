"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function useAvatarUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadAvatar(blob: Blob, userId: string): Promise<string> {
    setUploading(true);
    setError(null);

    try {
      const supabase = createBrowserSupabaseClient();
      const storagePath = `${userId}/avatar.webp`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(storagePath, blob, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: true,
        });

      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(storagePath);

      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from("users")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);

      if (updateError) throw new Error(updateError.message);

      return `${publicUrl}?t=${Date.now()}`;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Upload failed";
      setError(message);
      throw caught;
    } finally {
      setUploading(false);
    }
  }

  return { uploadAvatar, uploading, error };
}
