"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, LogOut, Archive, ArchiveRestore, UserPlus, Check, Search, Trash2, Pencil, FileText, FileImage, FileSpreadsheet, File, Download } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useConversationMembers } from "@/hooks/use-conversation-members";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { ConversationWithDetails, User, Message } from "@/types/database";

interface SharedFile {
  messageId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
  senderName: string;
}

interface ChatInfoPanelProps {
  conversation: ConversationWithDetails;
  onlineUserIds: string[];
  currentUserId: string;
  currentUserRole?: string;
  onClose: () => void;
  onConversationUpdate?: () => void;
}

export function ChatInfoPanel({
  conversation,
  onlineUserIds,
  currentUserId,
  currentUserRole,
  onClose,
  onConversationUpdate,
}: ChatInfoPanelProps) {
  const { members, refetch } = useConversationMembers(conversation.id);
  const router = useRouter();
  const isGroup = conversation.type === "group";
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [adding, setAdding] = useState<string | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(conversation.name || "");
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);

  const currentMember = members.find((member) => member.user_id === currentUserId);
  const isAdmin = currentMember?.role === "admin";
  const isSystemAdmin = currentUserRole === "admin";
  const memberUserIds = members.map((member) => member.user_id);

  useEffect(() => {
    if (!showAddMembers) return;
    async function fetchAvailableUsers() {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase
        .from("users_public")
        .select("*")
        .eq("is_active", true);
      if (data) {
        const nonMembers = (data as User[]).filter(
          (appUser) => !memberUserIds.includes(appUser.id)
        );
        setAvailableUsers(nonMembers);
      }
    }
    fetchAvailableUsers();
  }, [showAddMembers, memberUserIds.join(",")]);

  useEffect(() => {
    async function fetchSharedFiles() {
      setLoadingFiles(true);
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase
        .from("messages")
        .select("id, content_type, metadata, created_at, sender:users!inner(display_name)")
        .eq("conversation_id", conversation.id)
        .in("content_type", ["file", "image"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) {
        const files: SharedFile[] = data
          .filter((msg: Record<string, unknown>) => msg.metadata && (msg.metadata as Record<string, unknown>).file_url)
          .map((msg: Record<string, unknown>) => {
            const meta = msg.metadata as Record<string, unknown>;
            const sender = msg.sender as { display_name: string } | null;
            return {
              messageId: msg.id as string,
              fileName: (meta.file_name as string) || "Unknown",
              fileUrl: meta.file_url as string,
              fileType: (meta.file_type as string) || "application/octet-stream",
              fileSize: (meta.file_size as number) || 0,
              createdAt: msg.created_at as string,
              senderName: sender?.display_name || "Unknown",
            };
          });
        setSharedFiles(files);
      }
      setLoadingFiles(false);
    }
    fetchSharedFiles();
  }, [conversation.id]);

  const filteredUsers = availableUsers.filter((appUser) =>
    appUser.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function handleAddMember(userId: string) {
    setAdding(userId);
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.from("conversation_members").insert({
      conversation_id: conversation.id,
      user_id: userId,
      role: "member",
    });
    if (!error) {
      setAvailableUsers((prev) => prev.filter((appUser) => appUser.id !== userId));
      await refetch();
    }
    setAdding(null);
  }

  async function handleRemoveMember(userId: string) {
    const supabase = createBrowserSupabaseClient();
    await supabase
      .from("conversation_members")
      .delete()
      .eq("conversation_id", conversation.id)
      .eq("user_id", userId);
    await refetch();
  }

  async function handleToggleArchive() {
    if (!conversation.is_archived) {
      setShowArchiveConfirm(true);
      return;
    }
    await doArchive(false);
  }

  async function doArchive(archive: boolean) {
    const supabase = createBrowserSupabaseClient();
    await supabase
      .from("conversations")
      .update({ is_archived: archive })
      .eq("id", conversation.id);
    onConversationUpdate?.();
  }

  async function handleLeaveGroup() {
    const supabase = createBrowserSupabaseClient();
    await supabase
      .from("conversation_members")
      .delete()
      .eq("conversation_id", conversation.id)
      .eq("user_id", currentUserId);
    router.push("/chat");
  }

  async function handleRenameGroup() {
    const trimmed = editedName.trim();
    if (!trimmed || trimmed === conversation.name) {
      setIsEditingName(false);
      setEditedName(conversation.name || "");
      return;
    }
    const supabase = createBrowserSupabaseClient();
    await supabase
      .from("conversations")
      .update({ name: trimmed })
      .eq("id", conversation.id);
    setIsEditingName(false);
    onConversationUpdate?.();
  }

  async function handleDeleteConversation() {
    const otherName = conversation.other_user?.display_name || "this user";
    if (!confirm(`Delete this conversation with ${otherName}? All messages and files will be permanently removed.`)) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/conversations/${conversation.id}`, { method: "DELETE" });
      if (response.ok) {
        onConversationUpdate?.();
        router.push("/chat");
      } else {
        const body = await response.json();
        alert(body.error || "Failed to delete conversation");
      }
    } catch {
      alert("Failed to delete conversation");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {showArchiveConfirm && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
            <h2 className="text-base font-semibold text-neutral-800">Archive group?</h2>
            <p className="text-sm text-neutral-500">
              Members won&apos;t be able to send new messages. The group will be moved to the archived section.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowArchiveConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowArchiveConfirm(false);
                  await doArchive(true);
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 md:hidden"
        onClick={onClose}
      />
    <div className="fixed inset-0 z-50 md:relative md:inset-auto md:z-auto w-full md:w-[var(--info-panel-width)] border-l border-neutral-200 bg-white h-full overflow-y-auto shrink-0">
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 sticky top-0 bg-white z-10">
        <h3 className="text-sm font-semibold text-neutral-800">Chat Info</h3>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {conversation.is_archived && (
        <div className="mx-5 mt-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700 font-medium">This group is archived. Messages are read-only.</p>
        </div>
      )}

      {isGroup && (
        <div className="px-5 py-4 border-b border-neutral-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-2">
            Group name
          </p>
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                value={editedName}
                onChange={(event) => setEditedName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleRenameGroup();
                  if (event.key === "Escape") {
                    setIsEditingName(false);
                    setEditedName(conversation.name || "");
                  }
                }}
                autoFocus
                maxLength={100}
                className="flex-1 text-sm bg-white border border-neutral-300 rounded-md px-2 py-1 outline-none focus:border-primary-500 transition"
              />
              <button
                onClick={handleRenameGroup}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <span className="text-sm text-neutral-800 font-medium truncate flex-1">
                # {conversation.name}
              </span>
              {isAdmin && !conversation.is_archived && (
                <button
                  onClick={() => {
                    setEditedName(conversation.name || "");
                    setIsEditingName(true);
                  }}
                  className="p-1 rounded text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 opacity-0 group-hover:opacity-100 transition"
                  title="Rename group"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="px-5 py-4 border-b border-neutral-100">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Members ({members.length})
          </p>
          {isGroup && isAdmin && !conversation.is_archived && (
            <button
              onClick={() => setShowAddMembers(!showAddMembers)}
              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add
            </button>
          )}
        </div>

        {showAddMembers && (
          <div className="mb-3 border border-neutral-200 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-100">
              <Search className="w-3.5 h-3.5 text-neutral-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search users..."
                autoFocus
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-neutral-400"
              />
            </div>
            <div className="max-h-40 overflow-y-auto">
              {filteredUsers.length === 0 ? (
                <p className="text-xs text-neutral-400 px-3 py-3 text-center">
                  No users to add
                </p>
              ) : (
                filteredUsers.map((appUser) => (
                  <button
                    key={appUser.id}
                    onClick={() => handleAddMember(appUser.id)}
                    disabled={adding === appUser.id}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-neutral-50 transition text-left"
                  >
                    <Avatar
                      displayName={appUser.display_name}
                      avatarUrl={appUser.avatar_url}
                      isAgent={appUser.is_agent}
                      size="sm"
                    />
                    <span className="text-sm text-neutral-700 flex-1 truncate">
                      {appUser.display_name}
                    </span>
                    {adding === appUser.id ? (
                      <span className="text-xs text-neutral-400">Adding...</span>
                    ) : (
                      <Check className="w-3.5 h-3.5 text-primary-500 opacity-0 group-hover:opacity-100" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.user_id} className="flex items-center gap-2.5 group">
              <Avatar
                displayName={member.user.display_name}
                avatarUrl={member.user.avatar_url}
                isAgent={member.user.is_agent}
                size="sm"
                showPresence
                isOnline={onlineUserIds.includes(member.user_id)}
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-neutral-700 truncate block">
                  {member.user.display_name}
                </span>
              </div>
              {member.role === "admin" && (
                <span className="text-[10px] text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                  admin
                </span>
              )}
              {isGroup && isAdmin && member.user_id !== currentUserId && member.role !== "admin" && (
                <button
                  onClick={() => handleRemoveMember(member.user_id)}
                  className="text-[10px] text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition px-1.5 py-0.5"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <SharedFilesSection files={sharedFiles} loading={loadingFiles} />

      {isGroup && (
        <div className="px-5 py-4 space-y-1">
          {isAdmin && (
            <button
              onClick={handleToggleArchive}
              className="w-full text-left text-sm text-neutral-600 hover:bg-neutral-50 px-3 py-2 rounded-lg transition"
            >
              {conversation.is_archived ? (
                <>
                  <ArchiveRestore className="w-4 h-4 inline mr-2" />
                  Unarchive group
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4 inline mr-2" />
                  Archive group
                </>
              )}
            </button>
          )}
          <button
            onClick={handleLeaveGroup}
            className="w-full text-left text-sm text-error hover:bg-red-50 px-3 py-2 rounded-lg transition"
          >
            <LogOut className="w-4 h-4 inline mr-2" />
            Leave group
          </button>
        </div>
      )}

      {isSystemAdmin && !isGroup && (
        <div className="px-5 py-4 border-t border-neutral-100">
          <button
            onClick={handleDeleteConversation}
            disabled={deleting}
            className="w-full text-left text-sm text-error hover:bg-red-50 px-3 py-2 rounded-lg transition disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4 inline mr-2" />
            {deleting ? "Deleting..." : "Delete conversation"}
          </button>
        </div>
      )}
    </div>
    </>
  );
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return FileImage;
  if (fileType === "application/pdf") return FileText;
  if (fileType === "text/csv") return FileSpreadsheet;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function downloadFile(url: string, fileName: string) {
  let blobUrl: string | null = null;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Download failed");
    const blob = await response.blob();
    blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    if (blobUrl) setTimeout(() => URL.revokeObjectURL(blobUrl!), 200);
  }
}

function SharedFilesSection({ files, loading }: { files: SharedFile[]; loading: boolean }) {
  const images = files.filter((file) => file.fileType.startsWith("image/"));
  const documents = files.filter((file) => !file.fileType.startsWith("image/"));
  const [lightboxImage, setLightboxImage] = useState<SharedFile | null>(null);

  useEffect(() => {
    if (!lightboxImage) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxImage(null);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [lightboxImage]);

  if (loading) {
    return (
      <div className="px-5 py-4 border-b border-neutral-100">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-3">
          Shared Files
        </p>
        <div className="space-y-2">
          {[1, 2, 3].map((placeholder) => (
            <div key={placeholder} className="h-10 bg-neutral-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (files.length === 0) return null;

  return (
    <div className="px-5 py-4 border-b border-neutral-100">
      {images.length > 0 && (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-3">
            Shared Images ({images.length})
          </p>
          <div className="grid grid-cols-3 gap-1.5 mb-4">
            {images.map((image) => (
              <button
                key={image.messageId}
                onClick={() => setLightboxImage(image)}
                className="aspect-square rounded-lg overflow-hidden bg-neutral-100 hover:opacity-80 transition cursor-pointer"
              >
                <img
                  src={image.fileUrl}
                  alt={image.fileName}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </>
      )}

      {documents.length > 0 && (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-3">
            Shared Files ({documents.length})
          </p>
          <div className="space-y-1.5">
            {documents.map((doc) => {
              const Icon = getFileIcon(doc.fileType);
              return (
                <button
                  key={doc.messageId}
                  onClick={() => downloadFile(doc.fileUrl, doc.fileName)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-neutral-50 transition group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-neutral-500" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm text-neutral-700 truncate">{doc.fileName}</p>
                    <p className="text-[10px] text-neutral-400">
                      {formatFileSize(doc.fileSize)} &middot; {doc.senderName}
                    </p>
                  </div>
                  <Download className="w-3.5 h-3.5 text-neutral-400 opacity-0 group-hover:opacity-100 transition shrink-0" />
                </button>
              );
            })}
          </div>
        </>
      )}

      {lightboxImage && createPortal(
        <div
          className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-8"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              downloadFile(lightboxImage.fileUrl, lightboxImage.fileName);
            }}
            className="absolute top-4 right-16 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition"
            aria-label="Download"
          >
            <Download className="w-6 h-6" />
          </button>
          <img
            src={lightboxImage.fileUrl}
            alt={lightboxImage.fileName}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(event) => event.stopPropagation()}
          />
        </div>,
        document.body
      )}
    </div>
  );
}
