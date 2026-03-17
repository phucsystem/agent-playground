"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useFileUpload, isFileBlocked, MAX_FILE_SIZE } from "@/hooks/use-file-upload";
import { useConversationMembers } from "@/hooks/use-conversation-members";
import { EmojiPicker } from "./emoji-picker";
import { GifPicker } from "./gif-picker";
import { SnippetModal } from "./snippet-modal";
import { MentionPicker } from "./mention-picker";
import type { MentionCandidate } from "./mention-picker";
import { Send, Paperclip, Loader2, X, Smile, ImageIcon, FileCode } from "lucide-react";
import { toast } from "sonner";
import type { ContentType, MessageWithSender } from "@/types/database";

interface SenderInfo {
  id: string;
  display_name: string;
  avatar_url: string | null;
  is_agent: boolean;
}

interface ChatInputProps {
  conversationId: string;
  senderId: string;
  senderInfo?: SenderInfo;
  placeholder?: string;
  onTyping?: () => void;
  onOptimisticMessage?: (message: MessageWithSender) => void;
}

export function ChatInput({
  conversationId,
  senderId,
  senderInfo,
  placeholder = "Type a message...",
  onTyping,
  onOptimisticMessage,
}: ChatInputProps) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const previewUrlsRef = useRef<Map<File, string>>(new Map());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showSnippetModal, setShowSnippetModal] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickerContainerRef = useRef<HTMLDivElement>(null);
  const { uploadFile, uploading } = useFileUpload();
  const { members } = useConversationMembers(conversationId);

  const mentionCandidates = useMemo<MentionCandidate[]>(() => {
    if (mentionQuery === null) return [];
    const query = mentionQuery.toLowerCase();
    return members
      .filter((member) => member.user_id !== senderId)
      .filter((member) => member.user.display_name.toLowerCase().includes(query))
      .map((member) => ({
        id: member.user_id,
        display_name: member.user.display_name,
        avatar_url: member.user.avatar_url,
        is_agent: member.user.is_agent,
      }));
  }, [mentionQuery, members, senderId]);

  function getMentionQueryFromCursor(text: string, cursorPos: number): string | null {
    const beforeCursor = text.slice(0, cursorPos);
    const lastAtIndex = beforeCursor.lastIndexOf("@");
    if (lastAtIndex === -1) return null;
    if (lastAtIndex > 0 && beforeCursor[lastAtIndex - 1] !== " " && beforeCursor[lastAtIndex - 1] !== "\n") return null;
    const query = beforeCursor.slice(lastAtIndex + 1);
    if (query.includes("\n")) return null;
    return query;
  }

  function insertMention(candidate: MentionCandidate) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursorPos = textarea.selectionStart;
    const beforeCursor = content.slice(0, cursorPos);
    const afterCursor = content.slice(cursorPos);
    const atIndex = beforeCursor.lastIndexOf("@");
    const newContent = beforeCursor.slice(0, atIndex) + `@${candidate.display_name} ` + afterCursor;
    setContent(newContent);
    setMentionQuery(null);
    setMentionIndex(0);
    requestAnimationFrame(() => {
      const newCursorPos = atIndex + candidate.display_name.length + 2;
      textarea.selectionStart = newCursorPos;
      textarea.selectionEnd = newCursorPos;
      textarea.focus();
    });
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerContainerRef.current && !pickerContainerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
        setShowGifPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function getPreviewUrl(file: File): string | null {
    if (!file.type.startsWith("image/")) return null;
    const existing = previewUrlsRef.current.get(file);
    if (existing) return existing;
    const url = URL.createObjectURL(file);
    previewUrlsRef.current.set(file, url);
    return url;
  }

  function addFiles(files: File[]) {
    const validFiles = files.filter((file) => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds 5MB limit`);
        return false;
      }
      const blockedReason = isFileBlocked(file);
      if (blockedReason) {
        toast.error(`${file.name}: ${blockedReason}`);
        return false;
      }
      return true;
    });
    if (validFiles.length === 0) return;
    setPendingFiles((prev) => [...prev, ...validFiles]);
  }

  function removeFile(fileToRemove: File) {
    const url = previewUrlsRef.current.get(fileToRemove);
    if (url) {
      URL.revokeObjectURL(url);
      previewUrlsRef.current.delete(fileToRemove);
    }
    setPendingFiles((prev) => prev.filter((file) => file !== fileToRemove));
  }

  function clearAllFiles() {
    for (const url of previewUrlsRef.current.values()) {
      URL.revokeObjectURL(url);
    }
    previewUrlsRef.current.clear();
    setPendingFiles([]);
  }

  useEffect(() => {
    const urlsRef = previewUrlsRef.current;
    return () => {
      for (const url of urlsRef.values()) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, []);

  async function sendMessage(
    messageContent: string,
    contentType: ContentType,
    metadata: Record<string, unknown> | null = null,
    messageId?: string
  ) {
    const supabase = createBrowserSupabaseClient();
    const row: Record<string, unknown> = {
      conversation_id: conversationId,
      sender_id: senderId,
      content: messageContent,
      content_type: contentType,
      metadata,
    };
    if (messageId) row.id = messageId;
    await supabase.from("messages").insert(row);
  }

  async function handleSend() {
    if (sending || uploading) return;

    if (pendingFiles.length > 0) {
      setSending(true);
      const filesToUpload = [...pendingFiles];
      clearAllFiles();
      for (const file of filesToUpload) {
        try {
          const messageId = crypto.randomUUID();
          const result = await uploadFile(file, conversationId, messageId);
          const isImage = file.type.startsWith("image/");
          const contentType: ContentType = isImage ? "image" : "file";
          await sendMessage(result.fileName, contentType, {
            file_name: result.fileName,
            file_size: result.fileSize,
            file_type: result.fileType,
            file_url: result.fileUrl,
          });
        } catch {
          // upload error handled by hook
        }
      }
      setSending(false);
      return;
    }

    const trimmed = content.trim();
    if (!trimmed) return;

    setContent("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }

    if (senderInfo && onOptimisticMessage) {
      const optimisticId = crypto.randomUUID();
      onOptimisticMessage({
        id: optimisticId,
        conversation_id: conversationId,
        sender_id: senderId,
        content: trimmed,
        content_type: "text",
        metadata: null,
        created_at: new Date().toISOString(),
        sender: senderInfo,
      });
      sendMessage(trimmed, "text", null, optimisticId);
      return;
    }

    setSending(true);
    await sendMessage(trimmed, "text");
    setSending(false);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (mentionCandidates.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionIndex((prev) => (prev + 1) % mentionCandidates.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionIndex((prev) => (prev - 1 + mentionCandidates.length) % mentionCandidates.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        insertMention(mentionCandidates[mentionIndex]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = event.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      addFiles(Array.from(selectedFiles));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handlePaste(event: React.ClipboardEvent) {
    const items = event.clipboardData?.items;
    if (!items) return;

    const pastedFiles: File[] = [];
    for (const item of items) {
      if (item.kind === "file") {
        const blob = item.getAsFile();
        if (!blob) continue;
        if (blob.type.startsWith("image/") && !blob.name.match(/\.\w+$/)) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
          const extension = blob.type.split("/")[1] || "png";
          pastedFiles.push(new File([blob], `paste-${timestamp}.${extension}`, { type: blob.type }));
        } else {
          pastedFiles.push(blob);
        }
      }
    }
    if (pastedFiles.length > 0) {
      event.preventDefault();
      addFiles(pastedFiles);
    }
  }

  function handleEmojiSelect(emoji: string) {
    setContent((prev) => prev + emoji);
    textareaRef.current?.focus();
  }

  async function handleSnippetSubmit(title: string, snippetContent: string) {
    setShowSnippetModal(false);
    setSending(true);
    const lineCount = snippetContent.split("\n").length;
    await sendMessage(snippetContent, "text", {
      is_snippet: true,
      snippet_title: title,
      line_count: lineCount,
    });
    setSending(false);
  }

  async function handleGifSelect(gifUrl: string) {
    setSending(true);
    await sendMessage(gifUrl, "image", {
      file_name: "gif",
      file_url: gifUrl,
      is_gif: true,
    });
    setSending(false);
  }

  const [dragOver, setDragOver] = useState(false);
  const isSendable = content.trim() || pendingFiles.length > 0;

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(event: React.DragEvent) {
    event.preventDefault();
    setDragOver(false);
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(event.dataTransfer.files);
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    }
  }

  return (
    <div
      className="mx-2 sm:mx-4 md:mx-6 mb-2 md:mb-4"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {pendingFiles.length > 0 && (
        <div className="bg-neutral-50 border border-neutral-200 border-b-0 rounded-2xl rounded-b-none px-3 pt-3 pb-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-thin">
            {pendingFiles.map((file, fileIndex) => {
              const previewUrl = getPreviewUrl(file);
              return (
                <div key={`${file.name}-${fileIndex}`} className="relative shrink-0 group rounded-xl border border-neutral-200 bg-white p-1 shadow-sm hover:shadow-md transition-shadow">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={file.name}
                      className="h-28 max-w-[220px] rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex items-center gap-2.5 px-3 py-2.5">
                      <Paperclip className="w-4 h-4 text-neutral-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-neutral-700 font-medium truncate max-w-[180px]">
                          {file.name}
                        </p>
                        <p className="text-[11px] text-neutral-400">
                          {(file.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => removeFile(file)}
                    className="absolute top-2 right-2 p-1 bg-black/50 backdrop-blur-sm rounded-full text-white opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-opacity cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {previewUrl && (
                    <span className="absolute bottom-2 left-2 text-[10px] text-white/90 bg-black/50 backdrop-blur-sm rounded px-1.5 py-0.5">
                      {(file.size / 1024).toFixed(0)} KB
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div
        className={`relative flex flex-col border rounded-2xl transition-all duration-200 ${
          pendingFiles.length > 0 ? "rounded-t-none border-neutral-200" : "border-neutral-200"
        } ${dragOver ? "border-primary-400 bg-primary-50/50 ring-2 ring-primary-100" : "bg-white focus-within:border-neutral-300 focus-within:shadow-sm"}`}
      >
        {mentionCandidates.length > 0 && (
          <MentionPicker
            candidates={mentionCandidates}
            selectedIndex={mentionIndex}
            onSelect={insertMention}
          />
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          accept="*/*"
          className="hidden"
        />

        {dragOver && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-primary-50/80 border-2 border-dashed border-primary-300 pointer-events-none">
            <p className="text-sm font-medium text-primary-600">Drop files here</p>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(event) => {
            const newContent = event.target.value;
            setContent(newContent);
            adjustHeight();
            onTyping?.();
            const cursorPos = event.target.selectionStart;
            const query = getMentionQueryFromCursor(newContent, cursorPos);
            setMentionQuery(query);
            setMentionIndex(0);
          }}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          placeholder={pendingFiles.length > 0 ? `${pendingFiles.length} file${pendingFiles.length > 1 ? "s" : ""} ready — press Send` : placeholder}
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none text-neutral-700 placeholder:text-neutral-400 text-[15px] leading-relaxed max-h-[120px] px-4 pt-3 pb-1"
        />

        <div className="flex items-center justify-between px-2 pb-2">
          <div ref={pickerContainerRef} className="flex items-center gap-0.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition shrink-0 cursor-pointer"
              title="Attach file"
            >
              <Paperclip className="w-[18px] h-[18px]" />
            </button>

            <div className="relative">
              <button
                onClick={() => {
                  setShowEmojiPicker(!showEmojiPicker);
                  setShowGifPicker(false);
                }}
                className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition cursor-pointer"
                title="Emoji"
              >
                <Smile className="w-[18px] h-[18px]" />
              </button>
              {showEmojiPicker && (
                <EmojiPicker
                  onSelect={handleEmojiSelect}
                  onClose={() => setShowEmojiPicker(false)}
                />
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => {
                  setShowGifPicker(!showGifPicker);
                  setShowEmojiPicker(false);
                }}
                className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition cursor-pointer"
                title="GIF"
              >
                <ImageIcon className="w-[18px] h-[18px]" />
              </button>
              {showGifPicker && (
                <GifPicker
                  onSelect={handleGifSelect}
                  onClose={() => setShowGifPicker(false)}
                />
              )}
            </div>

            <button
              onClick={() => setShowSnippetModal(true)}
              className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition cursor-pointer"
              title="Text snippet"
            >
              <FileCode className="w-[18px] h-[18px]" />
            </button>
          </div>

          <button
            onClick={handleSend}
            disabled={!isSendable || sending || uploading}
            className={`p-2 rounded-xl transition shrink-0 cursor-pointer ${
              isSendable && !sending && !uploading
                ? "bg-primary-500 hover:bg-primary-600 text-white shadow-sm"
                : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
            }`}
          >
            {sending || uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {showSnippetModal && (
        <SnippetModal
          onSubmit={handleSnippetSubmit}
          onClose={() => setShowSnippetModal(false)}
        />
      )}
    </div>
  );
}
