"use client";

import { useState, useCallback, useRef } from "react";

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
  const [pinnedIds, setPinnedIds] = useState<string[]>(() =>
    readPinnedIds(userId)
  );

  const pinnedIdsRef = useRef(pinnedIds);
  pinnedIdsRef.current = pinnedIds;

  const togglePin = useCallback(
    (conversationId: string) => {
      setPinnedIds((prev) => {
        const next = prev.includes(conversationId)
          ? prev.filter((id) => id !== conversationId)
          : [...prev, conversationId];
        writePinnedIds(userId, next);
        return next;
      });
    },
    [userId]
  );

  const cleanStalePins = useCallback(
    (validIds: string[]) => {
      const validSet = new Set(validIds);
      const current = pinnedIdsRef.current;
      const cleaned = current.filter((id) => validSet.has(id));
      if (cleaned.length !== current.length) {
        writePinnedIds(userId, cleaned);
        setPinnedIds(cleaned);
      }
    },
    [userId]
  );

  return { pinnedIds, togglePin, cleanStalePins };
}
