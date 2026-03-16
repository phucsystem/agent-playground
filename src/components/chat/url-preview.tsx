"use client";

import { ExternalLink } from "lucide-react";

interface UrlPreviewProps {
  url: string;
  metadata?: {
    og_title?: string;
    og_description?: string;
    og_image?: string;
    favicon?: string;
  } | null;
}

export function UrlPreview({ url, metadata }: UrlPreviewProps) {
  if (!metadata?.og_title) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary-500 hover:underline inline-flex items-center gap-1"
      >
        {url}
        <ExternalLink className="w-3 h-3" />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mt-1.5 border border-neutral-200 rounded-xl overflow-hidden hover:border-primary-300 transition max-w-sm"
    >
      {metadata.og_image && (
        <img
          src={metadata.og_image}
          alt={metadata.og_title}
          className="w-full h-32 object-cover"
        />
      )}
      <div className="p-3">
        <p className="text-sm font-medium text-neutral-800 line-clamp-1">
          {metadata.og_title}
        </p>
        {metadata.og_description && (
          <p className="text-xs text-neutral-500 line-clamp-2 mt-0.5">
            {metadata.og_description}
          </p>
        )}
        <p className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1">
          {metadata.favicon && (
            <img src={metadata.favicon} alt="" className="w-3 h-3" />
          )}
          {new URL(url).hostname}
        </p>
      </div>
    </a>
  );
}
