"use client";

import { useState, useCallback, useRef, useEffect } from "react";

const STORAGE_KEY_PREFIX = "conversation-order-";

function getStorageKey(userId: string, workspaceId: string, section: "dm" | "group") {
  return `${STORAGE_KEY_PREFIX}${userId}-${workspaceId}-${section}`;
}

function readOrder(userId: string, workspaceId: string, section: "dm" | "group"): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId, workspaceId, section));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeOrder(userId: string, workspaceId: string, section: "dm" | "group", ids: string[]) {
  localStorage.setItem(getStorageKey(userId, workspaceId, section), JSON.stringify(ids));
}

export function useConversationOrder(
  userId: string,
  workspaceId: string,
  section: "dm" | "group"
) {
  const [orderedIds, setOrderedIds] = useState<string[]>(() =>
    readOrder(userId, workspaceId, section)
  );

  const orderedIdsRef = useRef(orderedIds);
  orderedIdsRef.current = orderedIds;

  useEffect(() => {
    setOrderedIds(readOrder(userId, workspaceId, section));
  }, [userId, workspaceId, section]);

  const reorder = useCallback(
    (fromId: string, toId: string) => {
      setOrderedIds((prev) => {
        const fromIndex = prev.indexOf(fromId);
        const toIndex = prev.indexOf(toId);
        if (fromIndex === -1 || toIndex === -1) return prev;
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        writeOrder(userId, workspaceId, section, next);
        return next;
      });
    },
    [userId, workspaceId, section]
  );

  const insertIfMissing = useCallback(
    (ids: string[]) => {
      const current = orderedIdsRef.current;
      const currentSet = new Set(current);
      const newIds = ids.filter((id) => !currentSet.has(id));
      if (newIds.length === 0) return;
      const next = [...current, ...newIds];
      writeOrder(userId, workspaceId, section, next);
      setOrderedIds(next);
    },
    [userId, workspaceId, section]
  );

  const removeStale = useCallback(
    (validIds: string[]) => {
      const validSet = new Set(validIds);
      const current = orderedIdsRef.current;
      const cleaned = current.filter((id) => validSet.has(id));
      if (cleaned.length !== current.length) {
        writeOrder(userId, workspaceId, section, cleaned);
        setOrderedIds(cleaned);
      }
    },
    [userId, workspaceId, section]
  );

  return { orderedIds, reorder, insertIfMissing, removeStale };
}
