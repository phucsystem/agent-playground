import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const GOCLAW_URL = process.env.GOCLAW_URL;
const TEST_TIMEOUT_MS = 5_000;

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!GOCLAW_URL) {
    return NextResponse.json({ ok: false, error: "GOCLAW_URL not configured" }, { status: 500 });
  }

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);

    const response = await fetch(`${GOCLAW_URL}/health`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      return NextResponse.json({ ok: true, latencyMs });
    }

    return NextResponse.json({
      ok: false,
      latencyMs,
      error: `Health check returned ${response.status}`,
    });
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;

    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ ok: false, latencyMs, error: "Connection timeout" });
    }

    const errorMessage = error instanceof Error ? error.message : "Connection failed";
    return NextResponse.json({ ok: false, latencyMs, error: errorMessage });
  }
}
