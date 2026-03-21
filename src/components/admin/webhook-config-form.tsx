"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Info, HeartPulse, Puzzle, Bot, Webhook } from "lucide-react";

export type AgentMode = "custom" | "goclaw";

const GOCLAW_AGENT_KEY_PATTERN = /^[a-zA-Z0-9_-]*$/;

function generateWebhookSecret(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return "whsec_" + Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

interface WebhookConfigFormProps {
  agentMode: AgentMode;
  webhookUrl: string;
  webhookSecret: string;
  healthCheckUrl: string;
  goclawAgentKey: string;
  onModeChange: (mode: AgentMode) => void;
  onUrlChange: (url: string) => void;
  onSecretChange: (secret: string) => void;
  onHealthCheckUrlChange: (url: string) => void;
  onGoclawAgentKeyChange: (key: string) => void;
}

export function WebhookConfigForm({
  agentMode,
  webhookUrl,
  webhookSecret,
  healthCheckUrl,
  goclawAgentKey,
  onModeChange,
  onUrlChange,
  onSecretChange,
  onHealthCheckUrlChange,
  onGoclawAgentKeyChange,
}: WebhookConfigFormProps) {
  const [showSecret, setShowSecret] = useState(false);
  const isGoclaw = agentMode === "goclaw";

  useEffect(() => {
    if (!isGoclaw) return;

    const origin = window.location.origin;
    const isHttps = origin.startsWith("https://");
    const bridgeUrl = isHttps ? `${origin}/api/goclaw/bridge` : "";
    const goclawUrl = process.env.NEXT_PUBLIC_GOCLAW_URL || "";
    const healthUrl = goclawUrl?.startsWith("https://") ? `${goclawUrl}/health` : "";

    if (bridgeUrl) onUrlChange(bridgeUrl);
    if (healthUrl) onHealthCheckUrlChange(healthUrl);
    if (!webhookSecret) onSecretChange(generateWebhookSecret());
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only trigger on mode switch
  }, [isGoclaw]);

  function handleModeChange(mode: AgentMode) {
    if (mode === "custom") {
      onUrlChange("");
      onSecretChange("");
      onHealthCheckUrlChange("");
      onGoclawAgentKeyChange("");
    }
    onModeChange(mode);
  }

  function handleGoclawKeyChange(value: string) {
    if (GOCLAW_AGENT_KEY_PATTERN.test(value)) {
      onGoclawAgentKeyChange(value);
    }
  }

  return (
    <div className="space-y-3 pt-3 border-t border-neutral-100">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleModeChange("custom")}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition cursor-pointer border ${
            agentMode === "custom"
              ? "border-primary-500 bg-primary-50 text-primary-700"
              : "border-neutral-200 text-neutral-500 hover:border-neutral-300"
          }`}
        >
          <Webhook className="w-4 h-4" />
          Custom Webhook
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("goclaw")}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition cursor-pointer border ${
            agentMode === "goclaw"
              ? "border-primary-500 bg-primary-50 text-primary-700"
              : "border-neutral-200 text-neutral-500 hover:border-neutral-300"
          }`}
        >
          <Bot className="w-4 h-4" />
          GoClaw Agent
        </button>
      </div>

      {isGoclaw && (
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            GoClaw Agent Key <span className="text-error">*</span>
          </label>
          <input
            type="text"
            value={goclawAgentKey}
            onChange={(event) => handleGoclawKeyChange(event.target.value)}
            placeholder="e.g. playground-assistant"
            className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            required
          />
          <p className="flex items-center gap-1 mt-1 text-xs text-neutral-400">
            <Puzzle className="w-3 h-3" />
            Must match the agent key in your GoClaw config
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          Webhook URL <span className="text-error">*</span>
        </label>
        <input
          type="url"
          value={webhookUrl}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder={isGoclaw ? "https://your-domain.com/api/goclaw/bridge" : "https://your-agent.com/webhook"}
          className={`w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
            isGoclaw && webhookUrl ? "bg-neutral-50 text-neutral-500 cursor-not-allowed" : ""
          }`}
          readOnly={isGoclaw && !!webhookUrl}
          required
        />
        {isGoclaw && (
          <p className="mt-1 text-xs text-neutral-400">
            {webhookUrl ? "Auto-configured for GoClaw bridge" : "Enter your deployment URL + /api/goclaw/bridge"}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          Webhook Secret
          {isGoclaw ? (
            <span className="text-error ml-1">*</span>
          ) : (
            <span className="text-neutral-400 font-normal ml-1">(optional)</span>
          )}
        </label>
        <div className="relative">
          <input
            type={showSecret ? "text" : "password"}
            value={webhookSecret}
            onChange={(event) => onSecretChange(event.target.value)}
            placeholder="whsec_..."
            className={`w-full px-3 py-2 pr-10 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono ${
              isGoclaw ? "bg-neutral-50 text-neutral-500 cursor-not-allowed" : ""
            }`}
            readOnly={isGoclaw}
          />
          <button
            type="button"
            onClick={() => setShowSecret(!showSecret)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600"
          >
            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <p className="flex items-center gap-1 mt-1 text-xs text-neutral-400">
          <Info className="w-3 h-3" />
          {isGoclaw ? "Auto-generated — used to authenticate bridge requests" : "Sent as Bearer token in Authorization header"}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          Health Check URL
          <span className="text-neutral-400 font-normal ml-1">(optional)</span>
        </label>
        <input
          type="url"
          value={healthCheckUrl}
          onChange={(event) => onHealthCheckUrlChange(event.target.value)}
          placeholder="https://your-agent.com/health"
          className={`w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
            isGoclaw && healthCheckUrl ? "bg-neutral-50 text-neutral-500 cursor-not-allowed" : ""
          }`}
          readOnly={isGoclaw && !!healthCheckUrl}
        />
        <p className="flex items-center gap-1 mt-1 text-xs text-neutral-400">
          <HeartPulse className="w-3 h-3" />
          {isGoclaw && healthCheckUrl ? "Auto-configured from GoClaw server" : "GET endpoint returning 200 = agent is available"}
        </p>
      </div>
    </div>
  );
}
