"use client";

import { useMemo } from "react";
import type { MessageWithSender } from "@/types/database";

interface MemberReadInfo {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isAgent: boolean;
  lastReadAt: string | null;
}

export interface ReadReceiptUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export function useReadReceipts(
  messages: MessageWithSender[],
  members: MemberReadInfo[],
  currentUserId: string
) {
  const readReceiptsByMessageId = useMemo(() => {
    if (messages.length === 0 || members.length === 0) return new Map<string, ReadReceiptUser[]>();

    const otherMembers = members.filter(
      (member) => member.userId !== currentUserId && !member.isAgent
    );

    if (otherMembers.length === 0) return new Map<string, ReadReceiptUser[]>();

    const receiptMap = new Map<string, ReadReceiptUser[]>();

    for (const member of otherMembers) {
      if (!member.lastReadAt) continue;

      const readTime = new Date(member.lastReadAt).getTime();

      let lastReadMessageId: string | null = null;
      for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex--) {
        const message = messages[messageIndex];
        if (new Date(message.created_at).getTime() <= readTime) {
          lastReadMessageId = message.id;
          break;
        }
      }

      if (lastReadMessageId) {
        const existing = receiptMap.get(lastReadMessageId) || [];
        existing.push({
          userId: member.userId,
          displayName: member.displayName,
          avatarUrl: member.avatarUrl,
        });
        receiptMap.set(lastReadMessageId, existing);
      }
    }

    return receiptMap;
  }, [messages, members, currentUserId]);

  return { readReceiptsByMessageId };
}
