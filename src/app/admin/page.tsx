"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Bot,
  Pencil,
  Users,
  Power,
  PowerOff,
  Webhook,
  FileText,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import type { User } from "@/types/database";
import { useAgentConfigs } from "@/hooks/use-agent-configs";
import { WebhookConfigForm } from "@/components/admin/webhook-config-form";
import {
  AgentWebhookIndicator,
} from "@/components/admin/agent-webhook-actions";
import { EditUserDialog } from "@/components/admin/edit-user-dialog";

function generateToken() {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}|;:<>?";
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => charset[byte % charset.length]).join("");
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={(event) => { event.stopPropagation(); handleCopy(); }}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition cursor-pointer"
      title="Copy token"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-success" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
      {label && <span>{copied ? "Copied!" : label}</span>}
    </button>
  );
}

function UserActionMenu({
  appUser,
  currentUserId,
  hasWebhook,
  onEdit,
  onToggleActive,
  onEditWebhook,
  onViewLogs,
  onDelete,
}: {
  appUser: User;
  currentUserId: string;
  hasWebhook: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onEditWebhook?: () => void;
  onViewLogs?: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  function handleOpen(event: React.MouseEvent) {
    event.stopPropagation();
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.right - 192 });
    }
    setOpen(!open);
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition cursor-pointer"
        aria-label="Actions"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 w-48 bg-white rounded-lg border border-neutral-200 shadow-lg py-1"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <button
              onClick={() => { setOpen(false); onEdit(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5 text-neutral-400" />
              Edit profile
            </button>

            {hasWebhook && onEditWebhook && (
              <button
                onClick={() => { setOpen(false); onEditWebhook(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition cursor-pointer"
              >
                <Webhook className="w-3.5 h-3.5 text-neutral-400" />
                Edit webhook
              </button>
            )}

            {hasWebhook && onViewLogs && (
              <button
                onClick={() => { setOpen(false); onViewLogs(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-neutral-400" />
                Webhook logs
              </button>
            )}

            {appUser.id !== currentUserId && (
              <>
                <div className="border-t border-neutral-100 my-1" />
                <button
                  onClick={() => { setOpen(false); onToggleActive(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition cursor-pointer"
                >
                  {appUser.is_active ? (
                    <>
                      <PowerOff className="w-3.5 h-3.5 text-warning" />
                      Disable user
                    </>
                  ) : (
                    <>
                      <Power className="w-3.5 h-3.5 text-success" />
                      Enable user
                    </>
                  )}
                </button>
                <button
                  onClick={() => { setOpen(false); onDelete(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove user
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { currentUser, loading: userLoading } = useCurrentUser();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteType, setInviteType] = useState<"user" | "agent">("user");
  const [creating, setCreating] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [inviteName, setInviteName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [healthCheckUrl, setHealthCheckUrl] = useState("");
  const { configs, createConfig, updateConfig, toggleWebhook } = useAgentConfigs();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingWebhookUserId, setEditingWebhookUserId] = useState<string | null>(null);

  const agents = useMemo(() => users.filter((appUser) => appUser.is_agent), [users]);
  const people = useMemo(() => users.filter((appUser) => !appUser.is_agent), [users]);

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
    const isAgent = inviteType === "agent";

    const token = generateToken();
    const shortId = token.slice(0, 8);
    const supabase = createBrowserSupabaseClient();

    const displayName = inviteName.trim() || (isAgent ? "New Agent" : "New User");
    const { error } = await supabase.from("users").insert({
      email: `invite-${shortId}@placeholder.local`,
      display_name: displayName,
      avatar_url: isAgent ? `https://api.dicebear.com/9.x/bottts/svg?seed=${shortId}` : null,
      token,
      role: isAgent ? "agent" : "user",
      is_agent: isAgent,
      is_active: true,
    });

    if (error) {
      alert(`Failed: ${error.message}`);
      setCreating(false);
      return;
    }

    if (isAgent && webhookUrl) {
      if (healthCheckUrl && !healthCheckUrl.startsWith("https://")) {
        alert("Health check URL must start with https://");
        setCreating(false);
        return;
      }

      const { data: newUsers } = await supabase
        .from("users")
        .select("id")
        .eq("token", token)
        .single();

      if (newUsers) {
        const configResult = await createConfig(newUsers.id, webhookUrl, webhookSecret || undefined, healthCheckUrl || undefined);
        if (configResult.error) {
          alert(`User created but webhook config failed: ${configResult.error}`);
        }
      }
    }

    setGeneratedToken(token);
    setCreating(false);
    fetchUsers();
  }

  function resetInviteForm() {
    setShowInvite(false);
    setInviteType("user");
    setInviteName("");
    setGeneratedToken(null);
    setWebhookUrl("");
    setWebhookSecret("");
    setHealthCheckUrl("");
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

  function renderUserRow(appUser: User) {
    const config = configs.get(appUser.id);
    const hasWebhook = appUser.is_agent && !!config;

    return (
      <div
        key={appUser.id}
        onClick={() => setEditingUser(appUser)}
        className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 hover:bg-neutral-50 transition cursor-pointer ${
          !appUser.is_active ? "opacity-50" : ""
        }`}
      >
        <Avatar
          displayName={appUser.display_name}
          avatarUrl={appUser.avatar_url}
          isAgent={appUser.is_agent}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-800 truncate">
              {appUser.display_name}
            </span>
            {appUser.role === "admin" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-primary-100 text-primary-600">
                admin
              </span>
            )}
            {!appUser.is_active && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-red-50 text-red-500">
                disabled
              </span>
            )}
            {hasWebhook && (
              <AgentWebhookIndicator config={config} />
            )}
          </div>
          <p className="text-xs text-neutral-400 truncate">{appUser.email}</p>
        </div>

        <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
          <CopyButton text={appUser.token} label="Token" />

          <UserActionMenu
            appUser={appUser}
            currentUserId={currentUser!.id}
            hasWebhook={hasWebhook}
            onEdit={() => setEditingUser(appUser)}
            onToggleActive={() => toggleUserActive(appUser.id, appUser.is_active)}
            onEditWebhook={hasWebhook ? () => setEditingWebhookUserId(appUser.id) : undefined}
            onViewLogs={hasWebhook ? () => router.push(`/admin/webhooks?agent=${appUser.id}`) : undefined}
            onDelete={() => deleteUser(appUser.id, appUser.display_name)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/chat")}
              className="p-2 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 transition cursor-pointer"
              aria-label="Back to chat"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-neutral-900">Manage Users</h1>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Add
          </button>
        </div>

        {showInvite && (
          <div className="bg-white rounded-xl border border-neutral-200 p-5 mb-6 shadow-sm">
            {generatedToken ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">
                      {inviteType === "agent" ? "Agent" : "User"} created!
                    </p>
                    <p className="text-xs text-neutral-400">Share this token to grant access</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3">
                  <code className="flex-1 text-sm text-neutral-700 font-mono break-all select-all">
                    {generatedToken}
                  </code>
                  <CopyButton text={generatedToken} />
                </div>
                <div className="flex justify-end mt-4">
                  <button
                    onClick={resetInviteForm}
                    className="px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-neutral-800 mb-3">
                  Create new {inviteType === "agent" ? "agent" : "user"}
                </p>

                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setInviteType("user")}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer border ${
                      inviteType === "user"
                        ? "border-primary-500 bg-primary-50 text-primary-700"
                        : "border-neutral-200 text-neutral-500 hover:border-neutral-300"
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Person
                  </button>
                  <button
                    onClick={() => setInviteType("agent")}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer border ${
                      inviteType === "agent"
                        ? "border-primary-500 bg-primary-50 text-primary-700"
                        : "border-neutral-200 text-neutral-500 hover:border-neutral-300"
                    }`}
                  >
                    <Bot className="w-4 h-4" />
                    AI Agent
                  </button>
                </div>

                <label className="block text-xs font-medium text-neutral-500 mb-1">
                  {inviteType === "agent" ? "Agent name" : "Display name"}
                </label>
                <input
                  value={inviteName}
                  onChange={(event) => setInviteName(event.target.value)}
                  placeholder={inviteType === "agent" ? "e.g. CodeBot, ResearchAgent" : "e.g. John (they can change it later)"}
                  autoFocus
                  className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 transition mb-4"
                />

                {inviteType === "agent" && (
                  <WebhookConfigForm
                    webhookUrl={webhookUrl}
                    webhookSecret={webhookSecret}
                    healthCheckUrl={healthCheckUrl}
                    onUrlChange={setWebhookUrl}
                    onSecretChange={setWebhookSecret}
                    onHealthCheckUrlChange={setHealthCheckUrl}
                  />
                )}

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleCreateInvite}
                    disabled={creating}
                    className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition cursor-pointer"
                  >
                    {creating ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating...
                      </span>
                    ) : (
                      "Generate Token"
                    )}
                  </button>
                  <button
                    onClick={resetInviteForm}
                    className="px-4 py-2.5 text-sm text-neutral-500 hover:bg-neutral-100 rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {agents.length > 0 && (
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden mb-4 shadow-sm">
            <div className="px-5 py-3 border-b border-neutral-100 flex items-center gap-2">
              <Bot className="w-4 h-4 text-neutral-400" />
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                Agents ({agents.length})
              </p>
            </div>
            <div className="divide-y divide-neutral-100">
              {agents.map(renderUserRow)}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-neutral-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-neutral-400" />
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
              People ({people.length})
            </p>
          </div>
          <div className="divide-y divide-neutral-100">
            {people.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-neutral-400">No users yet. Click Add to invite someone.</p>
              </div>
            ) : (
              people.map(renderUserRow)
            )}
          </div>
        </div>
      </div>

      {editingUser && (
        <EditUserDialog
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={fetchUsers}
        />
      )}

      {editingWebhookUserId && (
        <InlineWebhookEditor
          userId={editingWebhookUserId}
          config={configs.get(editingWebhookUserId)}
          onClose={() => setEditingWebhookUserId(null)}
          onUpdate={updateConfig}
          onToggle={toggleWebhook}
        />
      )}
    </div>
  );
}

function InlineWebhookEditor({
  userId,
  config,
  onClose,
  onUpdate,
  onToggle,
}: {
  userId: string;
  config: import("@/types/database").AgentConfig | undefined;
  onClose: () => void;
  onUpdate: (userId: string, updates: { webhook_url?: string; webhook_secret?: string; health_check_url?: string | null }) => Promise<{ error: string | null }>;
  onToggle: (userId: string, isActive: boolean) => Promise<{ error: string | null }>;
}) {
  const [editUrl, setEditUrl] = useState(config?.webhook_url || "");
  const [editSecret, setEditSecret] = useState("");
  const [editHealthUrl, setEditHealthUrl] = useState(config?.health_check_url || "");
  const [saving, setSaving] = useState(false);

  if (!config) return null;

  async function handleSave() {
    setSaving(true);
    const updates: { webhook_url?: string; webhook_secret?: string; health_check_url?: string | null } = {};
    if (editUrl !== config!.webhook_url) updates.webhook_url = editUrl;
    if (editSecret) updates.webhook_secret = editSecret;
    const newHealthUrl = editHealthUrl.trim() || null;
    if (newHealthUrl !== (config!.health_check_url || null)) updates.health_check_url = newHealthUrl;

    if (Object.keys(updates).length > 0) {
      const result = await onUpdate(userId, updates);
      if (result.error) {
        alert(`Failed: ${result.error}`);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    onClose();
  }

  async function handleToggle() {
    await onToggle(userId, !config!.is_webhook_active);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5" onClick={(event) => event.stopPropagation()}>
        <h3 className="text-sm font-semibold text-neutral-800 mb-4 flex items-center gap-2">
          <Webhook className="w-4 h-4 text-neutral-400" />
          Webhook Configuration
        </h3>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">URL</label>
            <input
              type="url"
              value={editUrl}
              onChange={(event) => setEditUrl(event.target.value)}
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">
              New secret <span className="text-neutral-300 font-normal">(leave empty to keep current)</span>
            </label>
            <input
              type="password"
              value={editSecret}
              onChange={(event) => setEditSecret(event.target.value)}
              placeholder="whsec_..."
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">
              Health check URL <span className="text-neutral-300 font-normal">(optional)</span>
            </label>
            <input
              type="url"
              value={editHealthUrl}
              onChange={(event) => setEditHealthUrl(event.target.value)}
              placeholder="https://your-agent.com/health"
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={handleToggle}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${
              config.is_webhook_active
                ? "text-warning bg-amber-50 hover:bg-amber-100"
                : "text-success bg-green-50 hover:bg-green-100"
            }`}
          >
            {config.is_webhook_active ? (
              <><PowerOff className="w-3 h-3" /> Pause</>
            ) : (
              <><Power className="w-3 h-3" /> Resume</>
            )}
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-100 rounded-md transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !editUrl.startsWith("https://")}
              className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 rounded-md transition cursor-pointer"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
