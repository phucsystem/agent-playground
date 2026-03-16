"use client";

import { useState } from "react";
import { Webhook, Pause, Play, FileText, X, Check } from "lucide-react";
import type { AgentConfig } from "@/types/database";

interface AgentWebhookActionsProps {
  userId: string;
  config: AgentConfig | undefined;
  onToggle: (userId: string, isActive: boolean) => Promise<{ error: string | null }>;
  onUpdate: (userId: string, updates: { webhook_url?: string; webhook_secret?: string }) => Promise<{ error: string | null }>;
}

export function AgentWebhookIndicator({ config }: { config: AgentConfig | undefined }) {
  if (!config) return null;

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ml-1 ${
        config.is_webhook_active ? "bg-green-500" : "bg-neutral-300"
      }`}
      title={config.is_webhook_active ? "Webhook active" : "Webhook paused"}
    />
  );
}

export function AgentWebhookActions({
  userId,
  config,
  onToggle,
  onUpdate,
}: AgentWebhookActionsProps) {
  const [editing, setEditing] = useState(false);
  const [editUrl, setEditUrl] = useState(config?.webhook_url || "");
  const [editSecret, setEditSecret] = useState("");
  const [saving, setSaving] = useState(false);

  if (!config) return null;

  async function handleToggle() {
    await onToggle(userId, !config!.is_webhook_active);
  }

  async function handleSaveEdit() {
    setSaving(true);
    const updates: { webhook_url?: string; webhook_secret?: string } = {};
    if (editUrl !== config!.webhook_url) updates.webhook_url = editUrl;
    if (editSecret) updates.webhook_secret = editSecret;

    if (Object.keys(updates).length > 0) {
      const result = await onUpdate(userId, updates);
      if (result.error) {
        alert(`Failed: ${result.error}`);
      }
    }
    setSaving(false);
    setEditing(false);
    setEditSecret("");
  }

  function handleStartEdit() {
    setEditUrl(config!.webhook_url);
    setEditSecret("");
    setEditing(true);
  }

  if (editing) {
    return (
      <div className="mt-2 p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-2">
        <input
          type="url"
          value={editUrl}
          onChange={(event) => setEditUrl(event.target.value)}
          placeholder="https://..."
          className="w-full px-2 py-1.5 text-xs border border-neutral-200 rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <input
          type="password"
          value={editSecret}
          onChange={(event) => setEditSecret(event.target.value)}
          placeholder="New secret (leave empty to keep current)"
          className="w-full px-2 py-1.5 text-xs border border-neutral-200 rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <div className="flex gap-1">
          <button
            onClick={handleSaveEdit}
            disabled={saving || !editUrl.startsWith("https://")}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-neutral-300 transition"
          >
            <Check className="w-3 h-3" />
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-200 rounded-md transition"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleStartEdit}
        className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition cursor-pointer"
        title="Edit Webhook"
      >
        <Webhook className="w-4 h-4" />
      </button>
      <button
        onClick={handleToggle}
        className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
        title={config.is_webhook_active ? "Pause Webhook" : "Resume Webhook"}
      >
        {config.is_webhook_active ? (
          <Pause className="w-4 h-4 text-warning" />
        ) : (
          <Play className="w-4 h-4 text-success" />
        )}
      </button>
      <a
        href={`/admin/webhooks?agent=${userId}`}
        className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
        title="View Logs"
      >
        <FileText className="w-4 h-4" />
      </a>
    </div>
  );
}
