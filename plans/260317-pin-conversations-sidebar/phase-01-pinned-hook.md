---
phase: 1
priority: high
status: completed
effort: S
---

# Phase 1: `use-pinned-conversations` Hook

## Overview

Create a localStorage-backed hook that manages pinned conversation IDs per user.

## Related Code Files

- **Create:** `src/hooks/use-pinned-conversations.ts`

## Implementation Steps

### 1. Create the hook

```typescript
// src/hooks/use-pinned-conversations.ts
"use client";

import { useState, useCallback } from "react";

const STORAGE_KEY_PREFIX = "pinned-conversations-";

function getStorageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function readPinnedIds(userId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writePinnedIds(userId: string, ids: string[]) {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(ids));
}

export function usePinnedConversations(userId: string) {
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => readPinnedIds(userId));

  const togglePin = useCallback((conversationId: string) => {
    setPinnedIds((prev) => {
      const next = prev.includes(conversationId)
        ? prev.filter((id) => id !== conversationId)
        : [...prev, conversationId];
      writePinnedIds(userId, next);
      return next;
    });
  }, [userId]);

  const isPinned = useCallback(
    (conversationId: string) => pinnedIds.includes(conversationId),
    [pinnedIds]
  );

  const cleanStalePins = useCallback(
    (validIds: string[]) => {
      const validSet = new Set(validIds);
      const cleaned = pinnedIds.filter((id) => validSet.has(id));
      if (cleaned.length !== pinnedIds.length) {
        writePinnedIds(userId, cleaned);
        setPinnedIds(cleaned);
      }
    },
    [userId, pinnedIds]
  );

  return { pinnedIds, togglePin, isPinned, cleanStalePins };
}
```

### Key Details

- **SSR-safe:** `typeof window` check in `readPinnedIds`
- **Lazy init:** `useState(() => ...)` reads localStorage once on mount
- **`cleanStalePins`:** Called by ConversationList to remove IDs for deleted/archived conversations
- **No useEffect needed:** State initializes from localStorage synchronously

## Todo

- [ ] Create `src/hooks/use-pinned-conversations.ts`
- [ ] Verify SSR compatibility (no hydration mismatch)

## Success Criteria

- Hook reads/writes localStorage correctly
- `togglePin` adds/removes conversation IDs
- `isPinned` returns correct boolean
- `cleanStalePins` removes stale IDs
