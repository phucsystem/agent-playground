"use client";

import { useState, useCallback, useRef, useEffect } from "react";

const STORAGE_KEY_PREFIX = "pinned-conversations-";

function getStorageKey(userId: string, workspaceId?: string) {
  return workspaceId
    ? `${STORAGE_KEY_PREFIX}${userId}-${workspaceId}`
    : `${STORAGE_KEY_PREFIX}${userId}`;
}

function readPinnedIds(userId: string, workspaceId?: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId, workspaceId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writePinnedIds(userId: string, ids: string[], workspaceId?: string) {
  localStorage.setItem(getStorageKey(userId, workspaceId), JSON.stringify(ids));
}

export function usePinnedConversations(userId: string, workspaceId?: string) {
  const [pinnedIds, setPinnedIds] = useState<string[]>(() =>
    readPinnedIds(userId, workspaceId)
  );

  const pinnedIdsRef = useRef(pinnedIds);
  pinnedIdsRef.current = pinnedIds;

  useEffect(() => {
    setPinnedIds(readPinnedIds(userId, workspaceId));
  }, [userId, workspaceId]);

  const togglePin = useCallback(
    (conversationId: string) => {
      setPinnedIds((prev) => {
        const next = prev.includes(conversationId)
          ? prev.filter((id) => id !== conversationId)
          : [...prev, conversationId];
        writePinnedIds(userId, next, workspaceId);
        return next;
      });
    },
    [userId, workspaceId]
  );

  const cleanStalePins = useCallback(
    (validIds: string[]) => {
      const validSet = new Set(validIds);
      const current = pinnedIdsRef.current;
      const cleaned = current.filter((id) => validSet.has(id));
      if (cleaned.length !== current.length) {
        writePinnedIds(userId, cleaned, workspaceId);
        setPinnedIds(cleaned);
      }
    },
    [userId, workspaceId]
  );

  return { pinnedIds, togglePin, cleanStalePins };
}
