# Implementation Code Patterns & Examples

**Date:** 2026-03-16
**For:** Developers implementing chat UX optimizations
**Stack:** Next.js 16 + React 19 + Supabase Realtime

---

## 1. Virtual Scrolling (React Virtuoso)

### Pattern A: Basic Integration

```typescript
// src/components/chat/message-list.tsx
"use client";

import { VirtuosoMessageList } from 'react-virtuoso';
import { MessageItem } from './message-item';
import { TypingIndicator } from './typing-indicator';
import type { MessageWithSender } from '@/types/database';

interface MessageListProps {
  messages: MessageWithSender[];
  loading: boolean;
  currentUserId: string;
  typingUsers: { userId: string; displayName: string }[];
  onLoadMore: () => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
}

export function MessageList({
  messages,
  loading,
  currentUserId,
  typingUsers,
  onLoadMore,
  onToggleReaction,
}: MessageListProps) {
  if (loading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-neutral-400">Loading messages...</span>
      </div>
    );
  }

  return (
    <VirtuosoMessageList
      style={{ height: '100%' }}
      data={messages}
      // Render each message
      itemContent={(index, message) => (
        <MessageItem
          key={message.id}
          message={message}
          isGrouped={shouldGroup(message, messages[index - 1])}
          isCurrentUser={message.sender_id === currentUserId}
          onToggleReaction={(emoji) => onToggleReaction(message.id, emoji)}
        />
      )}
      // Footer: typing indicator
      footer={() => <TypingIndicator typingUsers={typingUsers} />}
      // Load more when scrolling to top
      startReached={onLoadMore}
      // Overscan: render 10 items above/below viewport (smooth scrolling)
      overscan={10}
      // Don't auto-follow new messages (chat handles manually)
      atBottomStateChange={(isAtBottom) => {
        // Optional: update "scroll to bottom" button visibility
      }}
    />
  );
}

// Message grouping logic (unchanged from current)
function shouldGroup(
  current: MessageWithSender,
  previous: MessageWithSender | undefined
) {
  if (!previous) return false;
  if (current.sender_id !== previous.sender_id) return false;
  const diffMs =
    new Date(current.created_at).getTime() -
    new Date(previous.created_at).getTime();
  return diffMs < 300000;
}
```

**Key differences from current:**
- `VirtuosoMessageList` handles scrolling, virtualization, overscan
- No manual `containerRef`, `onScroll`, or RAF logic needed
- `startReached` callback replaces manual scroll threshold check
- Footer automatically positioned (typing indicator works!)
- Message item rendering identical

---

### Pattern B: With Scroll-to-Bottom Button

```typescript
// src/components/chat/message-list-with-button.tsx
"use client";

import { useState, useRef } from 'react';
import { VirtuosoMessageList } from 'react-virtuoso';
import { ArrowDown } from 'lucide-react';
import type { MessageWithSender } from '@/types/database';

export function MessageList({
  messages,
  currentUserId,
  // ...other props
}: Props) {
  const [isAtBottom, setIsAtBottom] = useState(true);
  const virtuosoRef = useRef(null);

  return (
    <>
      <VirtuosoMessageList
        ref={virtuosoRef}
        style={{ height: '100%' }}
        data={messages}
        itemContent={(index, message) => (
          <MessageItem message={message} isCurrentUser={message.sender_id === currentUserId} />
        )}
        atBottomStateChange={setIsAtBottom}
        overscan={10}
      />

      {!isAtBottom && (
        <button
          onClick={() => virtuosoRef.current?.scrollToIndex(messages.length - 1)}
          className="fixed bottom-24 right-8 w-10 h-10 bg-white border border-neutral-200 rounded-full shadow-md hover:bg-neutral-50"
        >
          <ArrowDown className="w-4 h-4 text-neutral-600" />
        </button>
      )}
    </>
  );
}
```

---

## 2. Optimistic Message Sending

### Pattern A: Using Manual State Management

```typescript
// src/hooks/use-realtime-messages-optimistic.ts
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { MessageWithSender } from "@/types/database";

const PAGE_SIZE = 50;

interface PendingMessage extends MessageWithSender {
  status: 'sending' | 'sent';
  optimisticId?: string;
}

export function useRealtimeMessages(conversationId: string) {
  const [messages, setMessages] = useState<(MessageWithSender | PendingMessage)[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const offsetRef = useRef(0);
  const supabaseRef = useRef(createBrowserSupabaseClient());

  // Fetch historical messages
  const fetchMessages = useCallback(async (offset = 0) => {
    const supabase = supabaseRef.current;
    const { data, error: queryError } = await supabase
      .from("messages")
      .select("*, sender:users!messages_sender_id_fkey(...)")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const fetched = (data || []) as MessageWithSender[];
    const hasMoreMessages = fetched.length === PAGE_SIZE;

    if (offset === 0) {
      const reversed = fetched.reverse();
      setMessages(reversed);
      offsetRef.current = fetched.length;
    } else {
      setMessages((prev) => [...fetched.reverse(), ...prev]);
      offsetRef.current += fetched.length;
    }

    setHasMore(hasMoreMessages);
    setLoading(false);
  }, [conversationId]);

  // Load more (pagination)
  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      fetchMessages(offsetRef.current);
    }
  }, [hasMore, loading, fetchMessages]);

  // Send optimistic message
  const sendMessage = useCallback(
    async (content: string, userId: string, displayName: string) => {
      const optimisticId = `optimistic-${crypto.randomUUID()}`;

      // 1. Add optimistic message immediately
      const optimistic: PendingMessage = {
        id: optimisticId,
        optimisticId,
        content,
        conversation_id: conversationId,
        sender_id: userId,
        sender: {
          id: userId,
          display_name: displayName,
          avatar_url: null,
          is_agent: false,
        },
        content_type: 'text',
        metadata: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'sending',
      };

      setMessages((prev) => [...prev, optimistic]);

      try {
        // 2. Send to database
        const supabase = supabaseRef.current;
        const { data: inserted, error: insertError } = await supabase
          .from('messages')
          .insert({
            content,
            conversation_id: conversationId,
            sender_id: userId,
            content_type: 'text',
          })
          .select('*, sender:users!messages_sender_id_fkey(...)')
          .single();

        if (insertError) throw insertError;

        // 3. Remove optimistic, keep canonical (Realtime will add it anyway)
        setMessages((prev) =>
          prev.filter((m) => m.id !== optimisticId)
        );

        setError(null);
      } catch (err) {
        // Error: remove optimistic, show retry UI
        setMessages((prev) =>
          prev.filter((m) => m.id !== optimisticId)
        );
        setError('Failed to send message. Tap to retry.');
      }
    },
    [conversationId]
  );

  // Subscribe to realtime updates
  useEffect(() => {
    fetchMessages(0);

    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMessage = payload.new as MessageWithSender;

          // Fetch sender info if missing
          if (!newMessage.sender) {
            const { data: senderData } = await supabase
              .from('users_public')
              .select('id, display_name, avatar_url, is_agent')
              .eq('id', newMessage.sender_id)
              .single();

            if (senderData) {
              newMessage.sender = senderData;
            }
          }

          // Don't add if duplicate (from optimistic update)
          setMessages((prev) => {
            if (prev.some((msg) => msg.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [conversationId, fetchMessages]);

  return {
    messages,
    loading,
    hasMore,
    loadMore,
    sendMessage,
    error,
  };
}
```

### Pattern B: Using React 19 useOptimistic (Recommended)

```typescript
// src/components/chat/chat-container.tsx
"use client";

import { useOptimistic, useRef } from 'react';
import { MessageList } from './message-list';
import { ChatInput } from './chat-input';
import { useRealtimeMessages } from '@/hooks/use-realtime-messages';

export function ChatContainer({ conversationId, currentUser }: Props) {
  const { messages, sendMessage } = useRealtimeMessages(conversationId);

  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (state, newMessage) => [...state, newMessage]
  );

  const inputRef = useRef<HTMLInputElement>(null);

  const handleSendMessage = async (content: string) => {
    // Add optimistic update
    const tempId = crypto.randomUUID();
    addOptimisticMessage({
      id: tempId,
      content,
      status: 'sending',
      sender_id: currentUser.id,
      // ... other required fields
    });

    // Clear input immediately
    if (inputRef.current) {
      inputRef.current.value = '';
    }

    try {
      // Send to server
      const { data } = await fetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ content, conversationId }),
      }).then(r => r.json());

      // Realtime updates canonical version
    } catch (error) {
      // Remove optimistic on error
      console.error('Send failed:', error);
      // User can retry
    }
  };

  return (
    <>
      <MessageList messages={optimisticMessages} />
      <ChatInput
        ref={inputRef}
        onSend={handleSendMessage}
        conversationId={conversationId}
      />
    </>
  );
}
```

---

## 3. Keyboard Shortcuts

### Pattern A: Basic Hook

```typescript
// src/hooks/use-keyboard-shortcuts.ts
"use client";

import { useEffect, useCallback } from 'react';

interface ShortcutHandlers {
  onSendMessage?: () => void;
  onFocusSearch?: () => void;
  onClearInput?: () => void;
  onJumpToBottom?: () => void;
  onMarkAsRead?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const isMeta = event.metaKey || event.ctrlKey;

    // Cmd/Ctrl+K: Focus conversation search
    if (isMeta && event.key === 'k') {
      event.preventDefault();
      handlers.onFocusSearch?.();
    }

    // Cmd/Ctrl+Enter: Send message
    if (isMeta && event.key === 'Enter') {
      event.preventDefault();
      handlers.onSendMessage?.();
    }

    // Escape: Clear input focus
    if (event.key === 'Escape') {
      event.preventDefault();
      handlers.onClearInput?.();
    }

    // Cmd/Ctrl+J: Jump to bottom
    if (isMeta && event.key === 'j') {
      event.preventDefault();
      handlers.onJumpToBottom?.();
    }

    // Cmd/Ctrl+Shift+M: Mark as read/unread
    if (isMeta && event.shiftKey && event.key === 'M') {
      event.preventDefault();
      handlers.onMarkAsRead?.();
    }
  }, [handlers]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
```

### Pattern B: Integration in Chat Page

```typescript
// src/app/chat/[conversationId]/page.tsx
"use client";

import { useRef } from 'react';
import { MessageList } from '@/components/chat/message-list';
import { ChatInput } from '@/components/chat/chat-input';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useRealtimeMessages } from '@/hooks/use-realtime-messages';

export default function ChatPage({ params: { conversationId } }: Props) {
  const { messages, sendMessage } = useRealtimeMessages(conversationId);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);

  useKeyboardShortcuts({
    onSendMessage: () => {
      const input = inputRef.current;
      if (input && input.value.trim()) {
        sendMessage(input.value);
        input.value = '';
      }
    },
    onClearInput: () => {
      if (inputRef.current) {
        inputRef.current.value = '';
        inputRef.current.blur();
      }
    },
    onJumpToBottom: () => {
      if (messageListRef.current) {
        messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
      }
    },
  });

  return (
    <div className="flex flex-col h-screen">
      <MessageList ref={messageListRef} messages={messages} />
      <ChatInput ref={inputRef} onSend={sendMessage} />
    </div>
  );
}
```

---

## 4. Unread Markers

### Pattern: Visual Divider + Badge

```typescript
// src/components/chat/message-list-with-unread.tsx
"use client";

import { VirtuosoMessageList } from 'react-virtuoso';
import { MessageItem } from './message-item';
import type { MessageWithSender } from '@/types/database';

interface MessageListProps {
  messages: MessageWithSender[];
  lastReadAt: string | null;
  unreadCount: number;
}

export function MessageList({
  messages,
  lastReadAt,
  unreadCount,
}: MessageListProps) {
  // Find first unread message
  const firstUnreadIndex = lastReadAt
    ? messages.findIndex(m => new Date(m.created_at) > new Date(lastReadAt))
    : 0;

  return (
    <VirtuosoMessageList
      style={{ height: '100%' }}
      data={messages}
      itemContent={(index, message) => (
        <>
          {index === firstUnreadIndex && firstUnreadIndex > 0 && (
            <div className="flex items-center gap-3 py-4 px-6">
              <hr className="flex-1 border-neutral-200" />
              <span className="text-xs text-neutral-500">
                {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
              </span>
              <hr className="flex-1 border-neutral-200" />
            </div>
          )}
          <MessageItem message={message} />
        </>
      )}
      overscan={10}
    />
  );
}
```

---

## 5. File Upload Progress

### Pattern: Update useFileUpload Hook

```typescript
// src/hooks/use-file-upload.ts (updated)
"use client";

import { useState, useCallback } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

interface UploadProgress {
  [key: string]: number; // fileId -> percentage
}

export function useFileUpload() {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({});
  const [uploading, setUploading] = useState(false);

  const uploadFile = useCallback(
    async (file: File, conversationId: string, messageId: string) => {
      const fileId = `${messageId}-${file.name}`;
      const supabase = createBrowserSupabaseClient();

      try {
        setUploading(true);
        setUploadProgress((prev) => ({ ...prev, [fileId]: 0 }));

        const storagePath = `attachments/${conversationId}/${messageId}/${file.name}`;

        // Upload with progress tracking
        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Get signed URL
        const { data: signedUrl } = await supabase.storage
          .from('attachments')
          .createSignedUrl(storagePath, 3600);

        // Create attachment record
        const { data: attachment, error: recordError } = await supabase
          .from('attachments')
          .insert({
            message_id: messageId,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            storage_path: storagePath,
            file_url: signedUrl?.signedUrl || '',
          })
          .select()
          .single();

        if (recordError) throw recordError;

        // Update progress to 100%
        setUploadProgress((prev) => ({ ...prev, [fileId]: 100 }));

        return attachment;
      } catch (error) {
        console.error('Upload failed:', error);
        setUploadProgress((prev) => {
          const newProgress = { ...prev };
          delete newProgress[fileId];
          return newProgress;
        });
        throw error;
      } finally {
        setUploading(false);
      }
    },
    []
  );

  return {
    uploadFile,
    uploadProgress,
    uploading,
  };
}
```

### Usage in Chat Input

```typescript
// src/components/chat/chat-input.tsx (updated)
"use client";

import { useState, useRef } from 'react';
import { useFileUpload } from '@/hooks/use-file-upload';

export function ChatInput({ onSend, conversationId }: Props) {
  const { uploadFile, uploadProgress } = useFileUpload();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.currentTarget.files;
    if (!files) return;

    for (const file of files) {
      try {
        const messageId = crypto.randomUUID();
        await uploadFile(file, conversationId, messageId);
      } catch (error) {
        console.error('File upload failed:', error);
      }
    }
  };

  return (
    <div className="p-4 border-t border-neutral-200">
      {Object.entries(uploadProgress).map(([fileId, progress]) => (
        <div key={fileId} className="mb-2">
          <div className="flex justify-between text-xs mb-1">
            <span>{fileId.split('-')[1]}</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-neutral-200 rounded h-2">
            <div
              className="bg-primary-500 h-2 rounded transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ))}
      <input
        type="file"
        onChange={handleFileSelect}
        className="block w-full"
      />
    </div>
  );
}
```

---

## 6. ARIA Accessibility

### Pattern: Semantic Message Container

```typescript
// src/components/chat/message-list-accessible.tsx
"use client";

import { VirtuosoMessageList } from 'react-virtuoso';
import { MessageItem } from './message-item';
import type { MessageWithSender } from '@/types/database';

export function MessageList({ messages, conversationName }: Props) {
  return (
    <div
      role="log"
      aria-live="polite"
      aria-label={`${conversationName} conversation`}
      className="flex-1 overflow-hidden"
    >
      <VirtuosoMessageList
        style={{ height: '100%' }}
        data={messages}
        itemContent={(index, message) => (
          <article
            key={message.id}
            aria-label={`Message from ${message.sender.display_name} at ${new Date(message.created_at).toLocaleTimeString()}`}
          >
            <h3 className="sr-only">{message.sender.display_name}</h3>
            <time dateTime={message.created_at} className="text-xs text-neutral-500">
              {new Date(message.created_at).toLocaleTimeString()}
            </time>
            <MessageItem message={message} />
          </article>
        )}
        overscan={10}
      />
    </div>
  );
}
```

### Pattern: Keyboard Navigation Wrapper

```typescript
// src/hooks/use-message-list-navigation.ts
"use client";

import { useEffect } from 'react';

export function useMessageListNavigation(messageIds: string[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const currentId = document.activeElement?.id;
      const currentIndex = messageIds.indexOf(currentId || '');

      if (event.key === 'ArrowUp' && currentIndex > 0) {
        event.preventDefault();
        const prevElement = document.getElementById(messageIds[currentIndex - 1]);
        prevElement?.focus();
      }

      if (event.key === 'ArrowDown' && currentIndex < messageIds.length - 1) {
        event.preventDefault();
        const nextElement = document.getElementById(messageIds[currentIndex + 1]);
        nextElement?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [messageIds]);
}
```

---

## Common Integration Points

### In Page Component
```typescript
// Bind all hooks at page level
'use client';

import { useRealtimeMessages } from '@/hooks/use-realtime-messages';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useMessageListNavigation } from '@/hooks/use-message-list-navigation';

export default function ChatPage({ params }) {
  const { messages, sendMessage } = useRealtimeMessages(params.conversationId);

  useKeyboardShortcuts({ onSendMessage: () => {...} });
  useMessageListNavigation(messages.map(m => m.id));

  return <ChatContainer messages={messages} />;
}
```

---

## Error Handling Pattern

```typescript
// Consistent error handling across features
async function withErrorHandler<T>(
  operation: () => Promise<T>,
  errorMessage: string
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    console.error(errorMessage, error);
    // Show toast notification
    toast.error(errorMessage);
    return null;
  }
}

// Usage
const result = await withErrorHandler(
  () => sendMessage(content),
  'Failed to send message'
);
```

---

## Testing Utilities

```typescript
// __tests__/chat-utils.test.ts
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageList } from '@/components/chat/message-list';

describe('MessageList with Virtuoso', () => {
  it('renders virtualized list without crashing', () => {
    const messages = Array.from({ length: 500 }, (_, i) => ({
      id: `msg-${i}`,
      content: `Message ${i}`,
      sender_id: 'user-1',
      // ... other fields
    }));

    render(<MessageList messages={messages} />);
    expect(screen.getByText(/Message/)).toBeInTheDocument();
  });

  it('calls loadMore when scrolling to top', async () => {
    const onLoadMore = jest.fn();
    render(<MessageList messages={[]} onLoadMore={onLoadMore} />);

    // Simulate scroll to top
    fireEvent.scroll(window, { top: 0 });

    expect(onLoadMore).toHaveBeenCalled();
  });
});
```

---

## Debugging Checklist

- [ ] Virtuoso not rendering: Check data array is populated
- [ ] Slow scroll: Verify overscan not set too high (10-20 is optimal)
- [ ] Duplicate messages: Add guard `!prev.some(m => m.id === incoming.id)`
- [ ] Keyboard shortcuts not firing: Check event.preventDefault() is called
- [ ] Accessibility issues: Use axe DevTools browser extension
- [ ] Memory leaks: Check all event listeners unsubscribed in cleanup

---

## Performance Monitoring

```typescript
// src/lib/performance.ts
export function measureRender(componentName: string) {
  if (typeof window === 'undefined') return;

  const startTime = performance.now();
  return () => {
    const endTime = performance.now();
    console.log(`${componentName} rendered in ${(endTime - startTime).toFixed(2)}ms`);
  };
}
```
