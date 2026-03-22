"use client";

import { useEffect, useRef, useState } from "react";
import type { MessageWithSender } from "@/types/database";

const THINKING_TIMEOUT_MS = 30_000;

export function useAgentThinking(
  messages: MessageWithSender[],
  hasAgent: boolean
) {
  const [agentThinking, setAgentThinking] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevMessageCountRef = useRef(messages.length);

  useEffect(() => {
    if (!hasAgent || messages.length === 0) {
      console.debug("[AgentThinking] skip: hasAgent=%s, msgLen=%d", hasAgent, messages.length);
      return;
    }

    const messageCount = messages.length;
    if (messageCount <= prevMessageCountRef.current) {
      console.debug("[AgentThinking] no-change: count=%d, prevRef=%d", messageCount, prevMessageCountRef.current);
      prevMessageCountRef.current = messageCount;
      return;
    }

    const latestMessage = messages[messageCount - 1];
    prevMessageCountRef.current = messageCount;

    console.debug(
      "[AgentThinking] new-msg: count=%d, sender=%s, is_agent=%s, id=%s",
      messageCount,
      latestMessage.sender?.display_name ?? "unknown",
      latestMessage.sender?.is_agent,
      latestMessage.id
    );

    if (!latestMessage.sender?.is_agent) {
      setAgentThinking(true);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        console.debug("[AgentThinking] timeout-clear after %dms", THINKING_TIMEOUT_MS);
        setAgentThinking(false);
      }, THINKING_TIMEOUT_MS);
    } else {
      setAgentThinking(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [messages, hasAgent]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { agentThinking };
}
