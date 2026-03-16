import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const TOKEN_STORAGE_KEY = "agent_playground_token";

export async function loginWithToken(token: string) {
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
  };
}

export function getSavedToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export async function logout() {
  const supabase = createBrowserSupabaseClient();
  await supabase.auth.signOut();
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}
