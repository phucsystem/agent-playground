import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

function safeCompare(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

export async function POST(request: NextRequest) {
  let body: { secret?: string; version?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { secret, version } = body;
  const webhookSecret = process.env.RELEASE_WEBHOOK_SECRET;

  if (!secret || !webhookSecret || !safeCompare(secret, webhookSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!version) {
    return NextResponse.json({ error: "Missing version" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const result = await supabase.channel("app-releases").send({
    type: "broadcast",
    event: "new-version",
    payload: { version },
  });

  if (result !== "ok") {
    return NextResponse.json({ error: "Broadcast failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, version });
}
