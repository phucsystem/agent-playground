"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface ImagePreviewProps {
  src: string;
  alt: string;
}

export function ImagePreview({ src, alt }: ImagePreviewProps) {
  const [showLightbox, setShowLightbox] = useState(false);
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <button onClick={() => setShowLightbox(true)} className="mt-1 block">
        {!loaded && (
          <div className="w-[300px] h-[200px] bg-neutral-200 animate-pulse rounded-xl" />
        )}
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          className={`max-w-[300px] max-h-[200px] rounded-xl object-cover border border-neutral-200 hover:border-primary-300 transition cursor-pointer ${loaded ? "" : "h-0 overflow-hidden"}`}
        />
      </button>

      {showLightbox && (
        <div
          className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-8"
          onClick={() => setShowLightbox(false)}
        >
          <button
            onClick={() => setShowLightbox(false)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
