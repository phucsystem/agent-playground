import { createClient } from "@supabase/supabase-js";
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

let cachedResult: CachedResult | null = null;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

      try {
        const response = await fetch(config.health_check_url!, {
          method: "GET",
          signal: controller.signal,
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
