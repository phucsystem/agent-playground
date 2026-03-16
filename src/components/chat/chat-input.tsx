"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useFileUpload } from "@/hooks/use-file-upload";
import { EmojiPicker } from "./emoji-picker";
import { GifPicker } from "./gif-picker";
import { Send, Paperclip, Loader2, X, Smile, ImageIcon } from "lucide-react";
import type { ContentType } from "@/types/database";

interface ChatInputProps {
  conversationId: string;
  senderId: string;
  placeholder?: string;
  onTyping?: () => void;
}

export function ChatInput({
  conversationId,
  senderId,
  placeholder = "Type a message...",
  onTyping,
}: ChatInputProps) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickerContainerRef = useRef<HTMLDivElement>(null);
  const { uploadFile, uploading } = useFileUpload();

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
    metadata: Record<string, unknown> | null = null
  ) {
    const supabase = createBrowserSupabaseClient();
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: messageContent,
      content_type: contentType,
      metadata,
    });
  }

  async function handleSend() {
    if (sending || uploading) return;

    if (pendingFile) {
      setSending(true);
      try {
        const messageId = crypto.randomUUID();
        const result = await uploadFile(pendingFile, conversationId, messageId);
        const isImage = pendingFile.type.startsWith("image/");
        const contentType: ContentType = isImage ? "image" : "file";

        await sendMessage(result.fileName, contentType, {
          file_name: result.fileName,
          file_size: result.fileSize,
          file_type: result.fileType,
          file_url: result.fileUrl,
        });

        setPendingFile(null);
      } catch {
        // upload error handled by hook
      }
      setSending(false);
      return;
    }

    const trimmed = content.trim();
    if (!trimmed) return;

    setSending(true);
    await sendMessage(trimmed, "text");
    setContent("");
    setSending(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setPendingFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleEmojiSelect(emoji: string) {
    setContent((prev) => prev + emoji);
    textareaRef.current?.focus();
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

  return (
    <div className="mx-6 mb-4">
      {pendingFile && (
        <div className="flex items-center gap-2 mb-2 px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl">
          <Paperclip className="w-4 h-4 text-neutral-400" />
          <span className="text-sm text-neutral-600 truncate flex-1">
            {pendingFile.name}
          </span>
          <span className="text-xs text-neutral-400">
            {(pendingFile.size / 1024).toFixed(0)} KB
          </span>
          <button
            onClick={() => setPendingFile(null)}
            className="p-0.5 text-neutral-400 hover:text-neutral-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 bg-neutral-100 rounded-2xl px-4 py-3">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,text/markdown,text/csv"
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-1 text-neutral-400 hover:text-neutral-600 transition shrink-0 mb-0.5"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <div ref={pickerContainerRef} className="relative shrink-0 mb-0.5">
          <button
            onClick={() => {
              setShowEmojiPicker(!showEmojiPicker);
              setShowGifPicker(false);
            }}
            className="p-1 text-neutral-400 hover:text-neutral-600 transition"
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

        <div className="relative shrink-0 mb-0.5">
          <button
            onClick={() => {
              setShowGifPicker(!showGifPicker);
              setShowEmojiPicker(false);
            }}
            className="p-1 text-neutral-400 hover:text-neutral-600 transition"
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

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            adjustHeight();
            onTyping?.();
          }}
          onKeyDown={handleKeyDown}
          placeholder={pendingFile ? "Press Send to upload file..." : placeholder}
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none text-neutral-700 placeholder:text-neutral-400 text-[15px] leading-relaxed max-h-[120px]"
        />

        <button
          onClick={handleSend}
          disabled={(!content.trim() && !pendingFile) || sending || uploading}
          className="p-2 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white rounded-lg transition shrink-0"
        >
          {sending || uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
