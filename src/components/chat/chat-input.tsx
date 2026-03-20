"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useConversationMembers } from "@/hooks/use-conversation-members";
import { EmojiPicker } from "./emoji-picker";
import { GifPicker } from "./gif-picker";
import { SnippetModal } from "./snippet-modal";
import { MentionPicker } from "./mention-picker";
import type { MentionCandidate } from "./mention-picker";
import { Send, Paperclip, Loader2, X, Smile, ImageIcon, FileCode, Upload, Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { ContentType, MessageWithSender } from "@/types/database";

interface SenderInfo {
  id: string;
  display_name: string;
  avatar_url: string | null;
  is_agent: boolean;
}

interface EditingMessage {
  id: string;
  content: string;
}

interface ChatInputProps {
  conversationId: string;
  senderId: string;
  senderInfo?: SenderInfo;
  placeholder?: string;
  onTyping?: () => void;
  onOptimisticMessage?: (message: MessageWithSender) => void;
  editingMessage?: EditingMessage | null;
  onCancelEdit?: () => void;
  onConfirmEdit?: (messageId: string, newContent: string) => void;
  initialPrompt?: string;
}

export function ChatInput({
  conversationId,
  senderId,
  senderInfo,
  placeholder = "Type a message...",
  onTyping,
  onOptimisticMessage,
  editingMessage,
  onCancelEdit,
  onConfirmEdit,
  initialPrompt,
}: ChatInputProps) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const previewUrlsRef = useRef<Map<File, string>>(new Map());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showSnippetModal, setShowSnippetModal] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);
  const [snippetInitialContent, setSnippetInitialContent] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickerContainerRef = useRef<HTMLDivElement>(null);
  const prevEditingIdRef = useRef<string | null>(null);
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
        toast.error(`${file.name} exceeds 20MB limit`);
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
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.style.height = "0px";
      const maxHeight = 200;
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
      textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
    });
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [content, adjustHeight]);

  useEffect(() => {
    const currentEditId = editingMessage?.id ?? null;
    if (currentEditId !== prevEditingIdRef.current) {
      prevEditingIdRef.current = currentEditId;
      if (editingMessage) {
        setContent(editingMessage.content);
        requestAnimationFrame(() => {
          textareaRef.current?.focus();
          adjustHeight();
        });
      }
    }
  }, [editingMessage, adjustHeight]);

  const initialPromptApplied = useRef(false);
  useEffect(() => {
    if (initialPrompt && !initialPromptApplied.current) {
      initialPromptApplied.current = true;
      setContent(initialPrompt);
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        adjustHeight();
      });
    }
  }, [initialPrompt, adjustHeight]);

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

    if (editingMessage && onConfirmEdit) {
      const trimmed = content.trim();
      if (!trimmed || trimmed === editingMessage.content) {
        onCancelEdit?.();
        return;
      }
      onConfirmEdit(editingMessage.id, trimmed);
      setContent("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.overflowY = "hidden";
      }
      return;
    }

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
      textareaRef.current.style.overflowY = "hidden";
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
        edited_at: null,
        is_deleted: false,
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
    if (event.key === "Escape" && editingMessage) {
      event.preventDefault();
      onCancelEdit?.();
      setContent("");
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  const MAX_FILE_SIZE = 20 * 1024 * 1024;

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = event.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      addFiles(Array.from(selectedFiles));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const SNIPPET_LINE_THRESHOLD = 10;
  const SNIPPET_CHAR_THRESHOLD = 500;

  function handlePaste(event: React.ClipboardEvent) {
    const clipboardFiles = event.clipboardData?.files;
    if (clipboardFiles && clipboardFiles.length > 0) {
      event.preventDefault();
      const filesArray: File[] = [];
      for (const file of clipboardFiles) {
        if (file.type.startsWith("image/") && !file.name) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
          const extension = file.type.split("/")[1] || "png";
          filesArray.push(new File([file], `paste-${timestamp}.${extension}`, { type: file.type }));
        } else {
          filesArray.push(file);
        }
      }
      addFiles(filesArray);
      return;
    }

    const pastedText = event.clipboardData?.getData("text/plain") || "";
    const lineCount = pastedText.split("\n").length;
    if (lineCount >= SNIPPET_LINE_THRESHOLD || pastedText.length >= SNIPPET_CHAR_THRESHOLD) {
      event.preventDefault();
      setSnippetInitialContent(pastedText);
      setShowSnippetModal(true);
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

  function handleDragEnter(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current++;
    if (event.dataTransfer.types.includes("Files")) {
      setIsDraggingOver(true);
    }
  }

  function handleDragLeave(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDraggingOver(false);
    }
  }

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingOver(false);
    const droppedFiles = event.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      addFiles(Array.from(droppedFiles));
    }
  }

  return (
    <div
      className="mx-2 sm:mx-4 md:mx-6 mb-2 md:mb-4 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDraggingOver && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary-50/90 border-2 border-dashed border-primary-400 rounded-2xl backdrop-blur-sm">
          <div className="flex flex-col items-center gap-1.5 text-primary-600">
            <Upload className="w-6 h-6" />
            <span className="text-sm font-medium">Drop files here</span>
          </div>
        </div>
      )}

      {editingMessage && (
        <div className="flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-2xl rounded-b-none px-3 py-2">
          <Pencil className="w-3.5 h-3.5 text-primary-500 shrink-0" />
          <span className="text-sm text-primary-700 font-medium flex-1">Editing message</span>
          <button
            onClick={() => { onCancelEdit?.(); setContent(""); }}
            className="p-0.5 text-primary-400 hover:text-primary-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!editingMessage && pendingFiles.length > 0 && (
        <div className="bg-neutral-100 rounded-2xl rounded-b-none px-3 pt-3 pb-2">
          <div className="flex gap-2 overflow-x-auto">
            {pendingFiles.map((file, fileIndex) => {
              const previewUrl = getPreviewUrl(file);
              return (
                <div key={`${file.name}-${fileIndex}`} className="relative shrink-0 group rounded-xl border border-neutral-200 bg-white p-1 shadow-sm">
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

      <div className={`relative flex items-end gap-1.5 bg-neutral-100 rounded-2xl px-3 py-2.5 ${(pendingFiles.length > 0 || editingMessage) ? "rounded-t-none" : ""}`}>
        {mentionCandidates.length > 0 && (
          <MentionPicker
            candidates={mentionCandidates}
            selectedIndex={mentionIndex}
            onSelect={insertMention}
          />
        )}
        {!editingMessage && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              accept="*/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-neutral-400 hover:text-neutral-600 transition shrink-0 cursor-pointer"
            >
              <Paperclip className="w-5 h-5" />
            </button>
          </>
        )}

        {!editingMessage && (
        <div ref={pickerContainerRef} className="flex items-center gap-0.5 shrink-0">
          <div className="relative">
            <button
              onClick={() => {
                setShowEmojiPicker(!showEmojiPicker);
                setShowGifPicker(false);
              }}
              className="p-1 text-neutral-400 hover:text-neutral-600 transition cursor-pointer"
              title="Emoji"
            >
              <Smile className="w-5 h-5" />
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
              className="p-1 text-neutral-400 hover:text-neutral-600 transition cursor-pointer"
              title="GIF"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
            {showGifPicker && (
              <GifPicker
                onSelect={handleGifSelect}
                onClose={() => setShowGifPicker(false)}
              />
            )}
          </div>

          <button
            onClick={() => { setSnippetInitialContent(""); setShowSnippetModal(true); }}
            className="p-1 text-neutral-400 hover:text-neutral-600 transition cursor-pointer"
            title="Text snippet"
          >
            <FileCode className="w-5 h-5" />
          </button>
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
          placeholder={pendingFiles.length > 0 ? `${pendingFiles.length} file${pendingFiles.length > 1 ? "s" : ""} ready — press Send to upload` : placeholder}
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none overflow-hidden text-neutral-700 placeholder:text-neutral-400 text-[15px] leading-relaxed py-1"
        />

        <button
          onClick={handleSend}
          disabled={(!content.trim() && pendingFiles.length === 0) || sending || uploading}
          className={`p-2 ${editingMessage ? "bg-primary-500 hover:bg-primary-600" : "bg-neutral-900 hover:bg-neutral-800"} disabled:bg-neutral-300 disabled:cursor-not-allowed text-white rounded-xl transition shrink-0 cursor-pointer`}
        >
          {sending || uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : editingMessage ? (
            <Check className="w-4 h-4" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>

      {showSnippetModal && (
        <SnippetModal
          onSubmit={handleSnippetSubmit}
          onClose={() => { setShowSnippetModal(false); setSnippetInitialContent(""); }}
          initialContent={snippetInitialContent}
        />
      )}
    </div>
  );
}
