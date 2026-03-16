import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const sessionRecordId = request.cookies.get("session_record_id")?.value;

  if (sessionRecordId) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await supabase
      .from("user_sessions")
      .delete()
      .eq("id", sessionRecordId);
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set("session_record_id", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
