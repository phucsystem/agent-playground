"use client";

import { FileText, FileImage, FileSpreadsheet, File } from "lucide-react";

interface FileCardProps {
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return FileImage;
  if (fileType === "application/pdf") return FileText;
  if (fileType === "text/csv") return FileSpreadsheet;
  return File;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileCard({ fileName, fileSize, fileType, fileUrl }: FileCardProps) {
  const Icon = getFileIcon(fileType);

  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2.5 bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 mt-1 hover:border-primary-400 transition max-w-xs"
    >
      <Icon className="w-5 h-5 text-neutral-500 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-700 truncate">
          {fileName}
        </p>
        <p className="text-[11px] text-neutral-400">
          {formatFileSize(fileSize)}
        </p>
      </div>
    </a>
  );
}
