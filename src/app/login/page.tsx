"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loginWithToken, getSavedToken } from "@/lib/auth";
import { Bot, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoLogging, setAutoLogging] = useState(true);

  function storeKickedSession(loginUser: Awaited<ReturnType<typeof loginWithToken>>) {
    if (loginUser.kickedSession) {
      sessionStorage.setItem(
        "kicked_session",
        JSON.stringify(loginUser.kickedSession)
      );
    }
  }

  useEffect(() => {
    const savedToken = getSavedToken();
    if (savedToken) {
      loginWithToken(savedToken)
        .then((loginUser) => {
          storeKickedSession(loginUser);
          router.push(loginUser.needsSetup ? "/setup" : "/chat");
        })
        .catch(() => {
          localStorage.removeItem("agent_playground_token");
          setAutoLogging(false);
        });
    } else {
      setAutoLogging(false);
    }
  }, [router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const loginUser = await loginWithToken(token);
      storeKickedSession(loginUser);
      router.push(loginUser.needsSetup ? "/setup" : "/chat");
    } catch (loginError: unknown) {
      const message =
        loginError instanceof Error ? loginError.message : "Login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (autoLogging) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-500 via-accent-500 to-warm-500 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-white/70" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 via-accent-500 to-warm-500 flex items-center justify-center p-4">
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Agent Playground
          </h1>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block text-left text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wide">
            Enter your token
          </label>
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste your access token"
            autoFocus
            className="w-full px-4 py-3 border border-neutral-200 rounded-lg text-base text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 transition"
          />

          {error && (
            <p className="text-sm text-error mt-2 text-left">{error}</p>
          )}

          <button
            type="submit"
            disabled={!token.trim() || loading}
            className="w-full mt-4 py-3 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 disabled:from-neutral-300 disabled:to-neutral-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <p className="text-xs text-neutral-400 mt-4">
          Token provided by your admin.
        </p>
      </div>

      <a
        href="https://www.buymeacoffee.com/phucsystem"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6"
      >
        <img
          src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
          alt="Buy Me A Coffee"
          className="h-10 hover:opacity-90 transition"
        />
      </a>
    </div>
  );
}
