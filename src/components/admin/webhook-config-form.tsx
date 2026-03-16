"use client";

import { useState } from "react";
import { Eye, EyeOff, Info } from "lucide-react";

interface WebhookConfigFormProps {
  webhookUrl: string;
  webhookSecret: string;
  onUrlChange: (url: string) => void;
  onSecretChange: (secret: string) => void;
}

export function WebhookConfigForm({
  webhookUrl,
  webhookSecret,
  onUrlChange,
  onSecretChange,
}: WebhookConfigFormProps) {
  const [showSecret, setShowSecret] = useState(false);

  return (
    <div className="space-y-3 pt-3 border-t border-neutral-100">
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          Webhook URL <span className="text-error">*</span>
        </label>
        <input
          type="url"
          value={webhookUrl}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="https://your-agent.com/webhook"
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          required
        />
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
    </div>
  );
}
