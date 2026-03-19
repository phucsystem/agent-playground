"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const BUILD_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown";

export function useVersionCheck() {
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const dismissedVersion = useRef<string | null>(null);

  const handleNewVersion = useCallback((version: string) => {
    if (version !== BUILD_VERSION && version !== "unknown") {
      if (version === dismissedVersion.current) return;
      setNewVersion(version);
      setDismissed(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("app-releases")
      .on("broadcast", { event: "new-version" }, (payload) => {
        const version = payload.payload?.version;
        if (version) handleNewVersion(version);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [handleNewVersion]);

  useEffect(() => {
    const poll = async () => {
      try {
        const response = await fetch("/api/version");
        if (response.ok) {
          const data = await response.json();
          if (data.version) handleNewVersion(data.version);
        }
      } catch {
        // Silently ignore network errors
      }
    };

    const intervalId = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [handleNewVersion]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    dismissedVersion.current = newVersion;
  }, [newVersion]);

  const reload = useCallback(() => window.location.reload(), []);

  const showBanner = newVersion !== null && !dismissed;

  return { showBanner, newVersion, dismiss, reload };
}
