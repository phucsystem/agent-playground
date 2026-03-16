"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";

interface GifResult {
  id: string;
  title: string;
  previewUrl: string;
  fullUrl: string;
}

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

const GIPHY_API_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY || "";

async function searchGifs(query: string): Promise<GifResult[]> {
  if (!GIPHY_API_KEY) return [];

  const endpoint = query.trim()
    ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=g`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=g`;

  const response = await fetch(endpoint);
  const data = await response.json();

  return (data.data || []).map((item: Record<string, unknown>) => {
    const images = item.images as Record<string, { url: string }>;
    return {
      id: item.id as string,
      title: item.title as string,
      previewUrl: images.fixed_width_small?.url || images.fixed_width?.url || "",
      fullUrl: images.fixed_width?.url || images.original?.url || "",
    };
  });
}

export function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const doSearch = useCallback(async (searchQuery: string) => {
    setLoading(true);
    const results = await searchGifs(searchQuery);
    setGifs(results);
    setLoading(false);
  }, []);

  useEffect(() => {
    doSearch("");
  }, [doSearch]);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 400);
  }

  if (!GIPHY_API_KEY) {
    return (
      <div className="absolute bottom-full left-0 mb-2 bg-white border border-neutral-200 rounded-xl shadow-lg w-[calc(100vw-1rem)] sm:w-[320px] max-w-[320px] z-50 p-4">
        <p className="text-sm text-neutral-500 text-center">
          GIF search requires NEXT_PUBLIC_GIPHY_API_KEY in .env
        </p>
      </div>
    );
  }

  return (
    <div className="absolute bottom-full left-0 mb-2 bg-white border border-neutral-200 rounded-xl shadow-lg w-[calc(100vw-1rem)] sm:w-[320px] max-w-[320px] z-50">
      <div className="p-2 border-b border-neutral-100">
        <input
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          placeholder="Search GIFs..."
          autoFocus
          className="w-full px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none focus:border-primary-400"
        />
      </div>

      <div className="max-h-[250px] overflow-y-auto p-1.5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
          </div>
        ) : gifs.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-8">
            No GIFs found
          </p>
        ) : (
          <div className="columns-2 gap-1.5">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => {
                  onSelect(gif.fullUrl);
                  onClose();
                }}
                className="w-full mb-1.5 rounded-lg overflow-hidden hover:opacity-80 transition break-inside-avoid"
              >
                <img
                  src={gif.previewUrl}
                  alt={gif.title}
                  className="w-full h-auto"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-2 py-1 border-t border-neutral-100">
        <p className="text-[10px] text-neutral-300 text-center">Powered by GIPHY</p>
      </div>
    </div>
  );
}
