"use client";

import { useState, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { createQueryClient } from "@/lib/query-client";

const MAX_AGE = 24 * 60 * 60 * 1000; // 24h

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  useEffect(() => {
    // Only persist conversations — messages have staleTime: Infinity which would
    // prevent refetch after restore, causing missed messages from previous sessions.
    const persister = createSyncStoragePersister({ storage: window.localStorage });

    persistQueryClient({
      queryClient,
      persister,
      maxAge: MAX_AGE,
      dehydrateOptions: {
        shouldDehydrateQuery: (query) =>
          Array.isArray(query.queryKey) && query.queryKey[0] === "conversations",
      },
    });
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
