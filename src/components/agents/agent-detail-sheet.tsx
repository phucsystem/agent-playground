"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { X, MessageCircle, Sparkles } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import { MarkdownContent } from "@/components/chat/markdown-content";
import { AgentStatsDisplay } from "./agent-stats-display";
import { CATEGORIES } from "./category-filter-bar";
import type { AgentCatalogEntry, AgentStats } from "@/types/agent-discovery";
import type { AgentHealthStatus } from "@/hooks/use-agent-health";

interface AgentDetailSheetProps {
  agent: AgentCatalogEntry;
  stats?: AgentStats;
  healthStatus: AgentHealthStatus;
  workspaceId: string;
  onClose: () => void;
}

export function AgentDetailSheet({ agent, stats, healthStatus, workspaceId, onClose }: AgentDetailSheetProps) {
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);
  const categoryInfo = CATEGORIES.find((cat) => cat.value === agent.category);

  async function handleMessageAgent(promptText?: string) {
    if (navigating) return;
    setNavigating(true);

    const supabase = createBrowserSupabaseClient();
    const { data: conversationId } = await supabase.rpc("find_or_create_dm", {
      other_user_id: agent.user_id,
      ws_id: workspaceId,
    });

    if (conversationId) {
      const url = promptText
        ? `/chat/${conversationId}?prompt=${encodeURIComponent(promptText)}`
        : `/chat/${conversationId}`;
      router.push(url);
    }
    setNavigating(false);
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-white shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between p-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-800">Agent Profile</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Avatar
              displayName={agent.display_name}
              avatarUrl={agent.avatar_url}
              isAgent
              size="lg"
              healthStatus={healthStatus}
            />
            <div>
              <h3 className="text-lg font-bold text-neutral-900">{agent.display_name}</h3>
              {categoryInfo && (
                <div className="flex items-center gap-1.5 text-neutral-500 text-sm mt-0.5">
                  {categoryInfo.icon}
                  <span>{categoryInfo.label}</span>
                  <span className="mx-1">·</span>
                  <span className={healthStatus === "healthy" ? "text-emerald-500" : "text-neutral-400"}>
                    {healthStatus === "healthy" ? "Online" : healthStatus === "unhealthy" ? "Offline" : "Unknown"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {agent.description && (
            <div>
              <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">About</h4>
              <MarkdownContent content={agent.description} />
            </div>
          )}

          {/* Tags */}
          {agent.tags && agent.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {agent.tags.map((tag) => (
                <span key={tag} className="px-2.5 py-1 bg-neutral-100 text-neutral-600 text-xs rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Stats */}
          <div>
            <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Performance (7 days)</h4>
            <div className="bg-neutral-50 rounded-lg p-3">
              <AgentStatsDisplay stats={stats} />
            </div>
          </div>

          {/* Sample Prompts */}
          {agent.sample_prompts && agent.sample_prompts.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Try it
              </h4>
              <div className="space-y-2">
                {agent.sample_prompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleMessageAgent(prompt)}
                    disabled={navigating}
                    className="w-full text-left px-3 py-2.5 rounded-lg border border-neutral-200 text-sm text-neutral-700 hover:bg-primary-50 hover:border-primary-200 hover:text-primary-700 transition cursor-pointer disabled:opacity-50"
                  >
                    &ldquo;{prompt}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="p-4 border-t border-neutral-100">
          <button
            onClick={() => handleMessageAgent()}
            disabled={navigating}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white text-sm font-semibold rounded-lg transition cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            Message this Agent
          </button>
        </div>
      </div>
    </>
  );
}
