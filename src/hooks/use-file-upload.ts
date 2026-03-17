"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const BLOCKED_EXTENSIONS = [
  ".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".pif",
  ".sh", ".bash", ".csh", ".ksh", ".zsh",
  ".app", ".action", ".command",
  ".ps1", ".psm1", ".psd1",
  ".vbs", ".vbe", ".js", ".jse", ".wsf", ".wsh",
  ".dll", ".sys", ".drv",
  ".bin", ".elf", ".deb", ".rpm", ".dmg", ".iso",
];

export function isFileBlocked(file: File): string | null {
  const fileName = file.name.toLowerCase();
  const blocked = BLOCKED_EXTENSIONS.find((ext) => fileName.endsWith(ext));
  if (blocked) return `Executable files (${blocked}) are not allowed`;
  if (file.type.startsWith("application/x-msdownload") || file.type.startsWith("application/x-executable")) {
    return "Executable files are not allowed";
  }
  return null;
}

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
      throw new Error("File size exceeds 20MB limit");
    }

    const blockedReason = isFileBlocked(file);
    if (blockedReason) {
      throw new Error(blockedReason);
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
