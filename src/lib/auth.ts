import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KickedSession } from "@/types/database";

const TOKEN_STORAGE_KEY = "agent_playground_token";

interface LoginResult {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  is_agent: boolean;
  needsSetup: boolean;
  kickedSession: KickedSession | null;
}

export async function loginWithToken(token: string): Promise<LoginResult> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Login failed");
  }

  const supabase = createBrowserSupabaseClient();
  await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });

  localStorage.setItem(TOKEN_STORAGE_KEY, token);

  return {
    ...data.user,
    needsSetup: !data.user.avatar_url,
    kickedSession: data.kicked_session || null,
  };
}

export function getSavedToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });

  const supabase = createBrowserSupabaseClient();
  await supabase.auth.signOut();
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}
