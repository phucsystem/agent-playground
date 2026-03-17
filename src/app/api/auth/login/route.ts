import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { User, KickedSession, UserSession } from "@/types/database";
import { parseDeviceName, MAX_SESSIONS } from "@/lib/session-utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let adminClient: ReturnType<typeof createClient<any>> | null = null;

function getSupabaseAdmin() {
  if (!adminClient) {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return adminClient;
}

async function enforceSessionCap(
  userId: string
): Promise<KickedSession | null> {
  const supabase = getSupabaseAdmin();

  const { data: sessions } = await supabase
    .from("user_sessions")
    .select("id, device_name, last_active_at, supabase_session_id")
    .eq("user_id", userId)
    .order("last_active_at", { ascending: true });

  if (!sessions || sessions.length < MAX_SESSIONS) return null;

  const oldestSession = sessions[0] as Pick<
    UserSession,
    "id" | "device_name" | "last_active_at" | "supabase_session_id"
  >;

  if (oldestSession.supabase_session_id) {
    try {
      await supabase.auth.admin.signOut(oldestSession.supabase_session_id);
    } catch {
      // Session may already be expired — continue with cleanup
    }
  }

  await supabase.from("user_sessions").delete().eq("id", oldestSession.id);

  return {
    device_name: oldestSession.device_name,
    last_active_at: oldestSession.last_active_at,
  };
}

async function createSessionRecord(
  userId: string,
  accessToken: string | null,
  userAgent: string | null
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const deviceName = parseDeviceName(userAgent);

  const { data } = await supabase
    .from("user_sessions")
    .insert({
      user_id: userId,
      supabase_session_id: accessToken,
      device_name: deviceName,
      user_agent: userAgent,
      last_active_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  return data?.id ?? "";
}

export async function POST(request: NextRequest) {
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json(
      { error: "invalid_token", message: "Token is required" },
      { status: 400 }
    );
  }

  const { data: user, error: userError } = await getSupabaseAdmin()
    .from("users")
    .select("*")
    .eq("token", token)
    .single<User>();

  if (userError || !user) {
    return NextResponse.json(
      { error: "invalid_token", message: "Invalid or expired token" },
      { status: 401 }
    );
  }

  if (!user.is_active) {
    return NextResponse.json(
      { error: "account_disabled", message: "Your account has been disabled" },
      { status: 403 }
    );
  }

  const authEmail = `${user.id}@internal.local`;
  const serverSecret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const password = createHash("sha256")
    .update(`${user.id}:${serverSecret}`)
    .digest("hex");

  const { data: existingAuthUser } =
    await getSupabaseAdmin().auth.admin.getUserById(user.id);

  if (!existingAuthUser?.user) {
    const { error: createError } =
      await getSupabaseAdmin().auth.admin.createUser({
        id: user.id,
        email: authEmail,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          is_agent: user.is_agent,
          app_user_id: user.id,
        },
      });

    if (createError) {
      console.error("Auth user creation failed:", createError.message);
      return NextResponse.json(
        { error: "auth_error", message: "Failed to provision auth account" },
        { status: 500 }
      );
    }
  } else {
    await getSupabaseAdmin().auth.admin.updateUserById(existingAuthUser.user.id, {
      email: authEmail,
      password,
    });
  }

  const ephemeralClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: signInData, error: signInError } =
    await ephemeralClient.auth.signInWithPassword({
      email: authEmail,
      password,
    });

  if (signInError) {
    return NextResponse.json(
      { error: "auth_error", message: "Authentication failed" },
      { status: 500 }
    );
  }

  const kickedSession = await enforceSessionCap(user.id);

  const userAgent = request.headers.get("user-agent");

  // Fix C1: Store actual access_token JWT so admin.signOut() can revoke it
  const sessionRecordId = await createSessionRecord(
    user.id,
    signInData.session.access_token,
    userAgent
  );

  const response = NextResponse.json({
    access_token: signInData.session.access_token,
    refresh_token: signInData.session.refresh_token,
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      is_agent: user.is_agent,
    },
    kicked_session: kickedSession,
  });

  response.cookies.set("session_record_id", sessionRecordId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
