# Phase 2: Notification Hook

**Priority:** High
**Status:** completed
**Depends on:** Phase 1

## Overview

Core hook `useNotificationSound` — global realtime listener that plays sound + shows native notification when DM or @mention received while tab unfocused.

## Files to Create

| File | Action |
|------|--------|
| `src/hooks/use-notification-sound.ts` | Create |

## Architecture

The hook creates its own global Supabase Realtime subscription (separate from `useRealtimeMessages` which is per-conversation). This avoids coupling and ensures notifications fire for ALL conversations.

```
useNotificationSound(currentUser, conversations)
  ├── Supabase channel: subscribe to ALL message INSERTs
  ├── On new message:
  │   ├── Skip if sender === currentUser.id
  │   ├── Skip if document.hidden === false (tab focused)
  │   ├── Skip if notification_enabled === false
  │   ├── Skip if debounce window active (3s)
  │   ├── Check: is DM? (find conversation in conversations list, check type === 'dm')
  │   ├── Check: has @mention? (content includes `@${currentUser.display_name}`)
  │   ├── If neither → skip
  │   ├── BroadcastChannel claim (only 1 tab handles)
  │   ├── Play /sounds/notification.mp3
  │   └── Show native Notification (if permission === 'granted')
  └── Returns: { requestPermission }
```

## Implementation Steps

### 1. Create `src/hooks/use-notification-sound.ts`

```typescript
"use client";

import { useEffect, useRef, useCallback } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { User, ConversationWithDetails } from "@/types/database";

interface NotificationMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  content_type: string;
}

const DEBOUNCE_MS = 3000;
const CHANNEL_NAME = "notification-leader";

export function useNotificationSound(
  currentUser: User | null,
  conversations: ConversationWithDetails[]
) {
  const lastSoundRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  // Preload audio on mount
  useEffect(() => {
    audioRef.current = new Audio("/sounds/notification.mp3");
    audioRef.current.volume = 0.5;
    return () => {
      audioRef.current = null;
    };
  }, []);

  // BroadcastChannel for multi-tab coordination
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    broadcastRef.current = new BroadcastChannel(CHANNEL_NAME);
    return () => {
      broadcastRef.current?.close();
      broadcastRef.current = null;
    };
  }, []);

  const playSound = useCallback(() => {
    const now = Date.now();
    if (now - lastSoundRef.current < DEBOUNCE_MS) return;
    lastSoundRef.current = now;

    audioRef.current?.play().catch(() => {
      // Browser may block autoplay — ignore silently
    });
  }, []);

  const showNotification = useCallback((title: string, body: string) => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    new Notification(title, {
      body,
      icon: "/icon.png", // fallback icon
      tag: "agent-playground-notification", // replaces previous
    });
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return "denied";
    if (Notification.permission === "granted") return "granted";
    return await Notification.requestPermission();
  }, []);

  // Global message listener
  useEffect(() => {
    if (!currentUser?.notification_enabled) return;
    if (!currentUser?.id) return;

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("global-notification-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const message = payload.new as NotificationMessage;

          // Skip own messages
          if (message.sender_id === currentUser.id) return;

          // Skip if tab is focused
          if (!document.hidden) return;

          // Find conversation in local state
          const conversation = conversations.find(
            (conv) => conv.id === message.conversation_id
          );
          if (!conversation) return;

          // Check: is DM?
          const isDm = conversation.type === "dm";

          // Check: has @mention?
          const hasMention = message.content
            ?.toLowerCase()
            .includes(`@${currentUser.display_name.toLowerCase()}`);

          if (!isDm && !hasMention) return;

          // Multi-tab: broadcast claim, first responder wins
          // Simple approach: just play in all tabs that pass filters
          // BroadcastChannel used to deduplicate
          const claimId = `notif-${message.id}`;
          const claimed = new Set<string>();

          if (broadcastRef.current) {
            // Try to claim this notification
            broadcastRef.current.postMessage({ type: "claim", id: claimId });
            // If another tab already claimed, skip
            // For simplicity: always play — the debounce handles rapid fire
          }

          // Play sound + show notification
          playSound();

          const senderName = conversation.other_user?.display_name
            || conversation.name
            || "Someone";
          const title = isDm
            ? `New message from ${senderName}`
            : `${senderName} mentioned you`;
          const body = message.content?.slice(0, 100) || "New message";
          showNotification(title, body);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentUser, conversations, playSound, showNotification]);

  return { requestPermission };
}
```

### Key Design Decisions

1. **Separate global channel**: Doesn't interfere with per-conversation `useRealtimeMessages`
2. **conversations prop**: Reuses already-fetched conversation list from `useConversations()` — no extra DB queries
3. **Debounce via timestamp**: Simple, no timer cleanup needed
4. **Audio preload**: Loaded once on mount for instant playback
5. **BroadcastChannel**: Simplified — debounce handles most multi-tab noise. Full leader election is YAGNI for MVP.
6. **Notification.tag**: Replaces previous notification instead of stacking

## Edge Cases

- **Browser blocks autoplay**: `.play().catch()` silently fails — feature degrades gracefully
- **No Notification API** (iOS Safari): Sound still plays
- **User in conversation but no conversations loaded yet**: `conversations.find()` returns undefined → skip (safe)
- **Mention with different casing**: Case-insensitive match via `.toLowerCase()`
- **Message with no content** (file/image): Skip notification body, still play sound for DMs

## Todo

- [ ] Create `use-notification-sound.ts`
- [ ] Verify global channel doesn't conflict with existing channels
- [ ] Test: DM received while tab unfocused → sound plays
- [ ] Test: @mention in group while tab unfocused → sound plays
- [ ] Test: tab focused → no sound
- [ ] Test: notification_enabled false → no sound

## Success Criteria

- [ ] Sound plays for DM when tab unfocused
- [ ] Sound plays for @mention when tab unfocused
- [ ] No sound when tab focused
- [ ] No sound for own messages
- [ ] No sound when notification_enabled is false
- [ ] Debounce prevents rapid-fire sounds
- [ ] Native notification shows (if permission granted)
