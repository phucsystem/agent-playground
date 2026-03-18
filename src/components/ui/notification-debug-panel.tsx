"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Bell, BellOff, Eye, EyeOff, Volume2, Monitor, MessageSquare, Bug, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { createElement } from "react";
import { MessageToast } from "./message-toast";

interface NotificationDebugPanelProps {
  onClose: () => void;
  notificationEnabled: boolean;
}

interface DebugLogEntry {
  timestamp: Date;
  type: "info" | "success" | "error" | "warning";
  message: string;
}

export function NotificationDebugPanel({ onClose, notificationEnabled }: NotificationDebugPanelProps) {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [tabVisible, setTabVisible] = useState(!document.hidden);
  const [tabFocused, setTabFocused] = useState(document.hasFocus());
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);
  const [broadcastSupported, setBroadcastSupported] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((type: DebugLogEntry["type"], message: string) => {
    setLogs((prev) => [...prev.slice(-49), { timestamp: new Date(), type, message }]);
  }, []);

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }
    setBroadcastSupported(typeof BroadcastChannel !== "undefined");
    addLog("info", "Debug panel opened");
    addLog("info", `Permission: ${typeof Notification !== "undefined" ? Notification.permission : "N/A"}`);
    addLog("info", `DB enabled: ${notificationEnabled}`);
    addLog("info", `Tab visible: ${!document.hidden}, focused: ${document.hasFocus()}`);
    addLog("info", `BroadcastChannel: ${typeof BroadcastChannel !== "undefined" ? "supported" : "unsupported"}`);
  }, [addLog, notificationEnabled]);

  useEffect(() => {
    const handleVisibility = () => {
      const visible = !document.hidden;
      setTabVisible(visible);
      addLog("info", `Tab visibility changed: ${visible ? "visible" : "hidden"}`);
    };
    const handleFocus = () => {
      setTabFocused(true);
      addLog("info", "Tab gained focus");
    };
    const handleBlur = () => {
      setTabFocused(false);
      addLog("info", "Tab lost focus");
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, [addLog]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleRequestPermission = async () => {
    if (typeof Notification === "undefined") {
      addLog("error", "Notification API not available");
      return;
    }
    addLog("info", "Requesting permission...");
    const result = await Notification.requestPermission();
    setPermission(result);
    addLog(result === "granted" ? "success" : "warning", `Permission result: ${result}`);
  };

  const handleTestDesktopNotification = () => {
    if (typeof Notification === "undefined") {
      addLog("error", "Notification API not available in this browser");
      return;
    }
    if (Notification.permission !== "granted") {
      addLog("error", `Cannot send: permission is "${Notification.permission}"`);
      return;
    }
    addLog("info", "Sending desktop notification...");
    try {
      new Notification("Debug Test", {
        body: "This is a debug desktop notification",
        tag: `debug-test-${Date.now()}`,
      });
      addLog("success", "Desktop notification sent");
    } catch (error) {
      addLog("error", `Desktop notification failed: ${error}`);
    }
  };

  const handleTestSound = () => {
    addLog("info", "Playing notification sound...");
    try {
      const audio = new Audio("/sounds/notification.mp3");
      audio.volume = 0.5;
      audio.play()
        .then(() => addLog("success", "Sound played successfully"))
        .catch((error) => addLog("error", `Sound playback failed: ${error.message}`));
    } catch (error) {
      addLog("error", `Sound init failed: ${error}`);
    }
  };

  const handleTestInAppToast = () => {
    addLog("info", "Showing in-app toast...");
    toast.custom(
      () =>
        createElement(MessageToast, {
          senderName: "Debug Test",
          avatarUrl: null,
          preview: "This is a debug in-app toast notification",
          conversationName: undefined,
          isGroup: false,
        }),
      { id: `debug-toast-${Date.now()}`, duration: 4000 }
    );
    addLog("success", "In-app toast triggered");
  };

  const handleTestFullFlow = () => {
    addLog("info", "Testing full notification flow...");
    addLog("info", `Tab hidden: ${document.hidden}, hasFocus: ${document.hasFocus()}`);

    if (document.hidden || !document.hasFocus()) {
      addLog("info", "→ Path: desktop notification + sound (tab not focused)");
      handleTestSound();
      handleTestDesktopNotification();
    } else {
      addLog("info", "→ Path: in-app toast + sound (tab focused)");
      handleTestSound();
      handleTestInAppToast();
    }
  };

  const statusColor = (ok: boolean) => ok ? "bg-emerald-400" : "bg-red-400";
  const statusText = (ok: boolean, onLabel: string, offLabel: string) => ok ? onLabel : offLabel;

  const logColor: Record<DebugLogEntry["type"], string> = {
    info: "text-neutral-400",
    success: "text-emerald-400",
    error: "text-red-400",
    warning: "text-amber-400",
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full max-w-md mx-4 bg-neutral-900 text-neutral-100 rounded-2xl shadow-2xl border border-neutral-700/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-700/50">
          <div className="flex items-center gap-2.5">
            <Bug className="w-4.5 h-4.5 text-amber-400" />
            <span className="text-sm font-semibold tracking-tight">Notification Debug</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-neutral-700/50 transition cursor-pointer">
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        </div>

        {/* Status grid */}
        <div className="px-5 py-4 grid grid-cols-2 gap-3">
          <StatusRow
            icon={<Bell className="w-3.5 h-3.5" />}
            label="Permission"
            value={permission}
            dotColor={statusColor(permission === "granted")}
          />
          <StatusRow
            icon={notificationEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
            label="DB Setting"
            value={statusText(notificationEnabled, "Enabled", "Disabled")}
            dotColor={statusColor(notificationEnabled)}
          />
          <StatusRow
            icon={tabVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            label="Tab Visible"
            value={statusText(tabVisible, "Yes", "No")}
            dotColor={statusColor(tabVisible)}
          />
          <StatusRow
            icon={<Monitor className="w-3.5 h-3.5" />}
            label="Tab Focused"
            value={statusText(tabFocused, "Yes", "No")}
            dotColor={statusColor(tabFocused)}
          />
          <StatusRow
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            label="BroadcastChannel"
            value={statusText(broadcastSupported, "Supported", "N/A")}
            dotColor={statusColor(broadcastSupported)}
          />
          <StatusRow
            icon={<MessageSquare className="w-3.5 h-3.5" />}
            label="Expected Path"
            value={!tabVisible || !tabFocused ? "Desktop" : "In-app"}
            dotColor={!tabVisible || !tabFocused ? "bg-violet-400" : "bg-sky-400"}
          />
        </div>

        {/* Actions */}
        <div className="px-5 pb-4 flex flex-wrap gap-2">
          {permission !== "granted" && (
            <ActionButton onClick={handleRequestPermission} label="Request Permission" variant="warning" />
          )}
          <ActionButton onClick={handleTestDesktopNotification} label="Desktop" icon={<Monitor className="w-3 h-3" />} />
          <ActionButton onClick={handleTestSound} label="Sound" icon={<Volume2 className="w-3 h-3" />} />
          <ActionButton onClick={handleTestInAppToast} label="Toast" icon={<MessageSquare className="w-3 h-3" />} />
          <ActionButton onClick={handleTestFullFlow} label="Full Flow" variant="primary" />
        </div>

        {/* Logs */}
        <div className="border-t border-neutral-700/50">
          <div className="flex items-center justify-between px-5 py-2">
            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">Event Log</span>
            <button
              onClick={() => setLogs([])}
              className="text-[11px] text-neutral-500 hover:text-neutral-300 transition cursor-pointer"
            >
              Clear
            </button>
          </div>
          <div className="h-40 overflow-y-auto px-5 pb-3 font-mono text-[11px] leading-relaxed scrollbar-thin">
            {logs.length === 0 && (
              <p className="text-neutral-600 italic">No events yet...</p>
            )}
            {logs.map((entry, index) => (
              <div key={index} className={`${logColor[entry.type]}`}>
                <span className="text-neutral-600">
                  {entry.timestamp.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>{" "}
                {entry.message}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ icon, label, value, dotColor }: { icon: React.ReactNode; label: string; value: string; dotColor: string }) {
  return (
    <div className="flex items-center gap-2 bg-neutral-800/50 rounded-lg px-3 py-2">
      <span className="text-neutral-400">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-neutral-500 uppercase tracking-wider">{label}</p>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
          <span className="text-xs font-medium truncate">{value}</span>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ onClick, label, icon, variant }: { onClick: () => void; label: string; icon?: React.ReactNode; variant?: "primary" | "warning" }) {
  const variantClasses = {
    primary: "bg-primary-600 hover:bg-primary-500 text-white",
    warning: "bg-amber-600 hover:bg-amber-500 text-white",
    default: "bg-neutral-700 hover:bg-neutral-600 text-neutral-200",
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${variantClasses[variant || "default"]}`}
    >
      {icon}
      {label}
    </button>
  );
}
