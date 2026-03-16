"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
];

interface UploadResult {
  fileUrl: string;
  storagePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function uploadFile(
    file: File,
    conversationId: string,
    messageId: string
  ): Promise<UploadResult> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error("File size exceeds 5MB limit");
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error(`File type ${file.type} is not supported`);
    }

    setUploading(true);
    setProgress(0);

    const supabase = createBrowserSupabaseClient();
    const storagePath = `${conversationId}/${messageId}/${file.name}`;

    const { error } = await supabase.storage
      .from("attachments")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      setUploading(false);
      throw new Error(`Upload failed: ${error.message}`);
    }

    const { data: signedUrlData } = await supabase.storage
      .from("attachments")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days

    const fileUrl = signedUrlData?.signedUrl || "";

    setUploading(false);
    setProgress(100);

    return {
      fileUrl,
      storagePath,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    };
  }

  return { uploadFile, uploading, progress };
}
