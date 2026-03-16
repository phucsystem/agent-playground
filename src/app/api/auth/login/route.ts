import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import type { User } from "@/types/database";

let adminClient: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (!adminClient) {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return adminClient;
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

  const email = user.email;
  const password = `agent-playground-${user.token}`;

  const { data: existingUsers } = await getSupabaseAdmin().auth.admin.listUsers();
  const authUser = existingUsers?.users?.find(
    (authUserItem) => authUserItem.email === email
  );

  if (!authUser) {
    const { error: createError } =
      await getSupabaseAdmin().auth.admin.createUser({
        email,
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
      return NextResponse.json(
        { error: "auth_error", message: "Failed to provision auth account" },
        { status: 500 }
      );
    }
  }

  const { data: signInData, error: signInError } =
    await getSupabaseAdmin().auth.signInWithPassword({
      email,
      password,
    });

  if (signInError) {
    return NextResponse.json(
      { error: "auth_error", message: "Authentication failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    access_token: signInData.session.access_token,
    refresh_token: signInData.session.refresh_token,
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      is_agent: user.is_agent,
    },
  });
}
