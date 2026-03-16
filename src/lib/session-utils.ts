import { UAParser } from "ua-parser-js";

const MAX_SESSIONS = 3;

export { MAX_SESSIONS };

export function parseDeviceName(userAgent: string | null): string {
  if (!userAgent) return "Unknown Device";
  const result = UAParser(userAgent);
  const browser = result.browser.name || "Unknown Browser";
  const os = result.os.name || "Unknown OS";
  return `${browser} on ${os}`;
}

export function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
