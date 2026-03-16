"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { WebhookLogWithDetails, DeliveryStatus } from "@/types/database";

interface WebhookLogFilters {
  agentId?: string;
  status?: DeliveryStatus;
  timeRange: "1h" | "24h" | "7d";
}

const TIME_RANGE_MS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

const PAGE_SIZE = 50;

export function useWebhookLogs(filters: WebhookLogFilters) {
  const [logs, setLogs] = useState<WebhookLogWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const offsetRef = useRef(0);

  const fetchLogs = useCallback(
    async (startOffset = 0, appendMode = false) => {
      if (!appendMode) setLoading(true);

      const supabase = createBrowserSupabaseClient();
      const threshold = new Date(Date.now() - TIME_RANGE_MS[filters.timeRange]).toISOString();

      let query = supabase
        .from("webhook_delivery_logs")
        .select(
          "*, agent:users!webhook_delivery_logs_agent_id_fkey(id, display_name, avatar_url), message:messages!webhook_delivery_logs_message_id_fkey(id, content, sender_id)",
          { count: "exact" },
        )
        .gte("created_at", threshold)
        .order("created_at", { ascending: false })
        .range(startOffset, startOffset + PAGE_SIZE - 1);

      if (filters.agentId) {
        query = query.eq("agent_id", filters.agentId);
      }
      if (filters.status) {
        query = query.eq("status", filters.status);
      }

      const { data, count } = await query;

      if (data) {
        const typedData = data as unknown as WebhookLogWithDetails[];
        if (appendMode) {
          setLogs((previous) => [...previous, ...typedData]);
        } else {
          setLogs(typedData);
        }
      }
      if (count !== null) setTotalCount(count);
      setLoading(false);
    },
    [filters.agentId, filters.status, filters.timeRange],
  );

  useEffect(() => {
    offsetRef.current = 0;
    fetchLogs(0, false);
  }, [fetchLogs]);

  function loadMore() {
    const nextOffset = offsetRef.current + PAGE_SIZE;
    offsetRef.current = nextOffset;
    fetchLogs(nextOffset, true);
  }

  const hasMore = logs.length < totalCount;

  return { logs, loading, totalCount, hasMore, loadMore, refresh: () => fetchLogs(0, false) };
}
