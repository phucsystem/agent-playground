import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export type AgentHealthStatus = "healthy" | "unhealthy";

interface AgentHealthEntry {
  agentId: string;
  status: AgentHealthStatus;
  checkedAt: string;
}

interface CachedResult {
  agents: AgentHealthEntry[];
  cachedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const HEALTH_TIMEOUT_MS = 5000;

const BLOCKED_IP_PREFIXES = [
  "10.", "172.16.", "172.17.", "172.18.", "172.19.",
  "172.20.", "172.21.", "172.22.", "172.23.", "172.24.",
  "172.25.", "172.26.", "172.27.", "172.28.", "172.29.",
  "172.30.", "172.31.", "192.168.", "127.", "0.",
  "169.254.",
];

let cachedResult: CachedResult | null = null;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function isBlockedUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    const hostname = parsed.hostname;
    if (hostname === "localhost" || hostname === "[::1]") return true;
    for (const prefix of BLOCKED_IP_PREFIXES) {
      if (hostname.startsWith(prefix)) return true;
    }
    return false;
  } catch {
    return true;
  }
}

export async function GET() {
  // Auth guard: verify caller is authenticated
  const supabaseUser = await createServerSupabaseClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (cachedResult && Date.now() - cachedResult.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({ agents: cachedResult.agents });
  }

  const supabase = getSupabaseAdmin();
  const { data: configs } = await supabase
    .from("agent_configs")
    .select("user_id, health_check_url")
    .not("health_check_url", "is", null)
    .eq("is_webhook_active", true);

  if (!configs || configs.length === 0) {
    cachedResult = { agents: [], cachedAt: Date.now() };
    return NextResponse.json({ agents: [] });
  }

  const checkedAt = new Date().toISOString();

  const results = await Promise.allSettled(
    configs.map(async (config): Promise<AgentHealthEntry> => {
      // SSRF protection: block private/internal IPs
      if (isBlockedUrl(config.health_check_url!)) {
        return {
          agentId: config.user_id,
          status: "unhealthy",
          checkedAt,
        };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

      try {
        const response = await fetch(config.health_check_url!, {
          method: "GET",
          signal: controller.signal,
          redirect: "error",
        });
        return {
          agentId: config.user_id,
          status: response.ok ? "healthy" : "unhealthy",
          checkedAt,
        };
      } catch {
        return {
          agentId: config.user_id,
          status: "unhealthy",
          checkedAt,
        };
      } finally {
        clearTimeout(timeout);
      }
    }),
  );

  const agents: AgentHealthEntry[] = results
    .filter(
      (result): result is PromiseFulfilledResult<AgentHealthEntry> =>
        result.status === "fulfilled",
    )
    .map((result) => result.value);

  cachedResult = { agents, cachedAt: Date.now() };

  return NextResponse.json({ agents });
}
