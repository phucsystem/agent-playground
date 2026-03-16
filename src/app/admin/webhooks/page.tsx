"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useWebhookLogs } from "@/hooks/use-webhook-logs";
import { Avatar } from "@/components/ui/avatar";
import { ArrowLeft, Loader2, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import type { User, DeliveryStatus, WebhookLogWithDetails } from "@/types/database";

function StatusBadge({ status, httpStatus }: { status: DeliveryStatus; httpStatus: number | null }) {
  if (status === "delivered") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
        &#x2713; {httpStatus}
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
        &#x2717; {httpStatus || "timeout"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">
      &#x23F3; pending
    </span>
  );
}

function LogRow({ log }: { log: WebhookLogWithDetails }) {
  const [expanded, setExpanded] = useState(false);
  const timestamp = new Date(log.created_at).toLocaleTimeString();
  const messagePreview = log.message?.content?.slice(0, 40) || "—";
  const latency =
    log.delivered_at && log.created_at
      ? `${((new Date(log.delivered_at).getTime() - new Date(log.created_at).getTime()) / 1000).toFixed(1)}s`
      : "—";

  return (
    <>
      <tr
        onClick={() => setExpanded(!expanded)}
        className="cursor-pointer hover:bg-neutral-50 transition"
      >
        <td className="px-4 py-2.5 text-xs text-neutral-500 whitespace-nowrap">
          {expanded ? <ChevronDown className="w-3 h-3 inline mr-1" /> : <ChevronRight className="w-3 h-3 inline mr-1" />}
          {timestamp}
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Avatar
              displayName={log.agent?.display_name || "Agent"}
              avatarUrl={log.agent?.avatar_url || null}
              isAgent={true}
              size="sm"
            />
            <span className="text-sm text-neutral-700">{log.agent?.display_name}</span>
          </div>
        </td>
        <td className="px-4 py-2.5 text-xs text-neutral-500 max-w-[200px] truncate">
          &ldquo;{messagePreview}&rdquo;
        </td>
        <td className="px-4 py-2.5">
          <StatusBadge status={log.status} httpStatus={log.http_status} />
        </td>
        <td className="px-4 py-2.5 text-xs text-neutral-500">{latency}</td>
      </tr>

      {expanded && (
        <tr className="bg-neutral-50">
          <td colSpan={5} className="px-8 py-3">
            <div className="space-y-1.5 text-xs">
              <div className="flex gap-2">
                <span className="font-medium text-neutral-500 w-16">Message</span>
                <span className="text-neutral-700">{log.message?.content || "—"}</span>
              </div>
              {log.last_error && (
                <div className="flex gap-2">
                  <span className="font-medium text-neutral-500 w-16">Error</span>
                  <code className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{log.last_error}</code>
                </div>
              )}
              <div className="flex gap-2">
                <span className="font-medium text-neutral-500 w-16">Attempts</span>
                <span className="text-neutral-700">{log.attempt_count} / 3</span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function WebhookLogsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, loading: userLoading } = useCurrentUser();

  const [agents, setAgents] = useState<Pick<User, "id" | "display_name">[]>([]);
  const [agentFilter, setAgentFilter] = useState(searchParams.get("agent") || "");
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | "">("");
  const [timeRange, setTimeRange] = useState<"1h" | "24h" | "7d">("24h");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { logs, loading, totalCount, hasMore, loadMore, refresh } = useWebhookLogs({
    agentId: agentFilter || undefined,
    status: (statusFilter as DeliveryStatus) || undefined,
    timeRange,
  });

  useEffect(() => {
    async function fetchAgents() {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase
        .from("users")
        .select("id, display_name")
        .eq("is_agent", true)
        .order("display_name");
      if (data) setAgents(data);
    }
    fetchAgents();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(refresh, 10_000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, refresh]);

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!currentUser || currentUser.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-500">Access denied. Admin only.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/admin")}
              className="p-2 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-neutral-900">Webhook Delivery Logs</h1>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-sm text-neutral-500">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
              className="rounded border-neutral-300"
            />
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? "animate-spin" : ""}`} />
            Auto-refresh
          </label>
        </div>

        <div className="flex gap-3 mb-4">
          <select
            value={agentFilter}
            onChange={(event) => setAgentFilter(event.target.value)}
            className="px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All agents</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.display_name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as DeliveryStatus | "")}
            className="px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All statuses</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>

          <select
            value={timeRange}
            onChange={(event) => setTimeRange(event.target.value as "1h" | "24h" | "7d")}
            className="px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="1h">Last 1h</option>
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7d</option>
          </select>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 text-sm">
              No webhook deliveries found for the selected filters.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-100 text-left">
                  <th className="px-4 py-2.5 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Time</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Agent</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Message</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {logs.map((log) => (
                  <LogRow key={log.id} log={log} />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && logs.length > 0 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-neutral-400">
              Showing {logs.length} of {totalCount} entries
            </span>
            {hasMore && (
              <button
                onClick={loadMore}
                className="px-4 py-2 text-sm text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition"
              >
                Load more
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WebhookLogsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
      }
    >
      <WebhookLogsContent />
    </Suspense>
  );
}
