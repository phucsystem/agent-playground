"use client";

import { useState, useEffect, useRef } from "react";
import { Eye, EyeOff, Info, HeartPulse, Puzzle } from "lucide-react";

const GOCLAW_AGENT_KEY_PATTERN = /^[a-zA-Z0-9_-]*$/;

interface WebhookConfigFormProps {
  webhookUrl: string;
  webhookSecret: string;
  healthCheckUrl: string;
  goclawAgentKey: string;
  onUrlChange: (url: string) => void;
  onSecretChange: (secret: string) => void;
  onHealthCheckUrlChange: (url: string) => void;
  onGoclawAgentKeyChange: (key: string) => void;
}

export function WebhookConfigForm({
  webhookUrl,
  webhookSecret,
  healthCheckUrl,
  goclawAgentKey,
  onUrlChange,
  onSecretChange,
  onHealthCheckUrlChange,
  onGoclawAgentKeyChange,
}: WebhookConfigFormProps) {
  const [showSecret, setShowSecret] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  const [flashingFields, setFlashingFields] = useState<Set<string>>(new Set());
  const prevKeyRef = useRef(goclawAgentKey);

  useEffect(() => {
    const previousKey = prevKeyRef.current;
    prevKeyRef.current = goclawAgentKey;

    if (!goclawAgentKey || goclawAgentKey === previousKey) return;

    const bridgeUrl = `${window.location.origin}/api/goclaw/bridge`;
    const goclawUrl = process.env.NEXT_PUBLIC_GOCLAW_URL || "";
    const healthUrl = goclawUrl ? `${goclawUrl}/health` : "";

    const newAutoFilled = new Set(autoFilledFields);
    const newFlashing = new Set<string>();

    if (!webhookUrl || autoFilledFields.has("webhookUrl")) {
      onUrlChange(bridgeUrl);
      newAutoFilled.add("webhookUrl");
      newFlashing.add("webhookUrl");
    }

    if (healthUrl && (!healthCheckUrl || autoFilledFields.has("healthCheckUrl"))) {
      onHealthCheckUrlChange(healthUrl);
      newAutoFilled.add("healthCheckUrl");
      newFlashing.add("healthCheckUrl");
    }

    setAutoFilledFields(newAutoFilled);
    if (newFlashing.size > 0) {
      setFlashingFields(newFlashing);
      setTimeout(() => setFlashingFields(new Set()), 1000);
    }
  }, [goclawAgentKey]);

  function handleUrlManualChange(value: string) {
    setAutoFilledFields((previous) => {
      const next = new Set(previous);
      next.delete("webhookUrl");
      return next;
    });
    onUrlChange(value);
  }

  function handleHealthUrlManualChange(value: string) {
    setAutoFilledFields((previous) => {
      const next = new Set(previous);
      next.delete("healthCheckUrl");
      return next;
    });
    onHealthCheckUrlChange(value);
  }

  function handleGoclawKeyChange(value: string) {
    if (GOCLAW_AGENT_KEY_PATTERN.test(value)) {
      onGoclawAgentKeyChange(value);
    }
  }

  return (
    <div className="space-y-3 pt-3 border-t border-neutral-100">
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          GoClaw Agent Key
          <span className="text-neutral-400 font-normal ml-1">(optional)</span>
        </label>
        <input
          type="text"
          value={goclawAgentKey}
          onChange={(event) => handleGoclawKeyChange(event.target.value)}
          placeholder="e.g. playground-assistant"
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <p className="flex items-center gap-1 mt-1 text-xs text-neutral-400">
          <Puzzle className="w-3 h-3" />
          Maps this agent to a GoClaw agent (from GoClaw config)
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          Webhook URL <span className="text-error">*</span>
        </label>
        <input
          type="url"
          value={webhookUrl}
          onChange={(event) => handleUrlManualChange(event.target.value)}
          placeholder="https://your-agent.com/webhook"
          className={`w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-500 ${
            flashingFields.has("webhookUrl") ? "bg-primary-50" : ""
          }`}
          required
        />
        {autoFilledFields.has("webhookUrl") && (
          <p className="mt-1 text-xs text-primary-500">Auto-filled from GoClaw key</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          Webhook Secret
          <span className="text-neutral-400 font-normal ml-1">(optional)</span>
        </label>
        <div className="relative">
          <input
            type={showSecret ? "text" : "password"}
            value={webhookSecret}
            onChange={(event) => onSecretChange(event.target.value)}
            placeholder="whsec_..."
            className="w-full px-3 py-2 pr-10 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono"
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
          Sent as Bearer token in Authorization header
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
          onChange={(event) => handleHealthUrlManualChange(event.target.value)}
          placeholder="https://your-agent.com/health"
          className={`w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-500 ${
            flashingFields.has("healthCheckUrl") ? "bg-primary-50" : ""
          }`}
        />
        {autoFilledFields.has("healthCheckUrl") ? (
          <p className="mt-1 text-xs text-primary-500">Auto-filled from GoClaw key</p>
        ) : (
          <p className="flex items-center gap-1 mt-1 text-xs text-neutral-400">
            <HeartPulse className="w-3 h-3" />
            GET endpoint returning 200 = agent is available
          </p>
        )}
      </div>
    </div>
  );
}
