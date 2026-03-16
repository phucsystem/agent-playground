"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Avatar } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Copy,
  Check,
  UserPlus,
  Loader2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Bot,
} from "lucide-react";
import type { User } from "@/types/database";

function generateToken() {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}|;:<>?";
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => charset[byte % charset.length]).join("");
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
      title="Copy token"
    >
      {copied ? (
        <Check className="w-4 h-4 text-success" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </button>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { currentUser, loading: userLoading } = useCurrentUser();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteIsAgent, setInviteIsAgent] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: true });
    if (data) setUsers(data as User[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  if (userLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!currentUser || currentUser.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-500">Access denied. Admin only.</p>
      </div>
    );
  }

  async function handleCreateInvite() {
    setCreating(true);

    const token = generateToken();
    const shortId = token.slice(0, 8);
    const supabase = createBrowserSupabaseClient();

    const { error } = await supabase.from("users").insert({
      email: `invite-${shortId}@placeholder.local`,
      display_name: "New User",
      token,
      role: inviteIsAgent ? "agent" : "user",
      is_agent: inviteIsAgent,
      is_active: true,
    });

    if (error) {
      alert(`Failed: ${error.message}`);
      setCreating(false);
      return;
    }

    setGeneratedToken(token);
    setCreating(false);
    fetchUsers();
  }

  function resetInviteForm() {
    setShowInvite(false);
    setInviteIsAgent(false);
    setGeneratedToken(null);
  }

  async function toggleUserActive(userId: string, currentlyActive: boolean) {
    const supabase = createBrowserSupabaseClient();
    await supabase
      .from("users")
      .update({ is_active: !currentlyActive })
      .eq("id", userId);
    fetchUsers();
  }

  async function deleteUser(userId: string, displayName: string) {
    if (!confirm(`Remove ${displayName}? This cannot be undone.`)) return;
    const supabase = createBrowserSupabaseClient();
    await supabase.from("users").delete().eq("id", userId);
    fetchUsers();
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push("/chat")}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-neutral-900">Manage Users</h1>
        </div>

        <button
          onClick={() => setShowInvite(true)}
          className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition mb-6"
        >
          <UserPlus className="w-5 h-5" />
          Invite Friend
        </button>

        {showInvite && (
          <div className="bg-white rounded-xl border border-neutral-200 p-5 mb-6">
            {generatedToken ? (
              <div>
                <p className="text-sm font-semibold text-neutral-800 mb-2">
                  Invite created! Share this token:
                </p>
                <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3">
                  <code className="flex-1 text-sm text-neutral-700 font-mono break-all">
                    {generatedToken}
                  </code>
                  <CopyButton text={generatedToken} />
                </div>
                <p className="text-xs text-neutral-400 mt-2">
                  Share this token with your friend. They paste it on the login page.
                </p>
                <button
                  onClick={resetInviteForm}
                  className="mt-4 text-sm text-primary-500 hover:underline"
                >
                  Done
                </button>
              </div>
            ) : (
              <div>
                <label className="flex items-center gap-2 mb-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inviteIsAgent}
                    onChange={(event) => setInviteIsAgent(event.target.checked)}
                    className="rounded border-neutral-300"
                  />
                  <Bot className="w-4 h-4 text-neutral-500" />
                  <span className="text-sm text-neutral-600">This is an AI agent</span>
                </label>

                <div className="flex gap-2">
                  <button
                    onClick={handleCreateInvite}
                    disabled={creating}
                    className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white text-sm font-semibold rounded-lg transition"
                  >
                    {creating ? "Creating..." : "Generate Token"}
                  </button>
                  <button
                    onClick={resetInviteForm}
                    className="px-4 py-2 text-sm text-neutral-500 hover:bg-neutral-100 rounded-lg transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-neutral-100">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
              Users ({users.length})
            </p>
          </div>

          <div className="divide-y divide-neutral-100">
            {users.map((appUser) => (
              <div
                key={appUser.id}
                className={`flex items-center gap-3 px-5 py-3 ${
                  !appUser.is_active ? "opacity-50" : ""
                }`}
              >
                <Avatar
                  displayName={appUser.display_name}
                  avatarUrl={appUser.avatar_url}
                  isAgent={appUser.is_agent}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-neutral-800 truncate">
                      {appUser.display_name}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        appUser.role === "admin"
                          ? "bg-primary-100 text-primary-600"
                          : appUser.role === "agent"
                          ? "bg-neutral-100 text-neutral-600"
                          : "bg-neutral-50 text-neutral-400"
                      }`}
                    >
                      {appUser.role}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 truncate">
                    {appUser.email}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <CopyButton text={appUser.token} />

                  {appUser.id !== currentUser.id && (
                    <>
                      <button
                        onClick={() => toggleUserActive(appUser.id, appUser.is_active)}
                        className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
                        title={appUser.is_active ? "Disable" : "Enable"}
                      >
                        {appUser.is_active ? (
                          <ToggleRight className="w-4 h-4 text-success" />
                        ) : (
                          <ToggleLeft className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => deleteUser(appUser.id, appUser.display_name)}
                        className="p-1.5 rounded-md text-neutral-400 hover:text-error hover:bg-red-50 transition"
                        title="Remove user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
