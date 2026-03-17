"use client";

interface TypingIndicatorProps {
  typingUsers: { userId: string; displayName: string }[];
  agentThinking?: boolean;
}

function PulsingDots() {
  return (
    <div className="flex items-center gap-[3px] px-3 py-2 bg-neutral-100 rounded-2xl rounded-bl-sm w-fit">
      <span className="w-[6px] h-[6px] bg-neutral-400 rounded-full animate-[pulse-dot_1.4s_ease-in-out_infinite]" />
      <span className="w-[6px] h-[6px] bg-neutral-400 rounded-full animate-[pulse-dot_1.4s_ease-in-out_0.2s_infinite]" />
      <span className="w-[6px] h-[6px] bg-neutral-400 rounded-full animate-[pulse-dot_1.4s_ease-in-out_0.4s_infinite]" />
    </div>
  );
}

export function TypingIndicator({ typingUsers, agentThinking }: TypingIndicatorProps) {
  if (typingUsers.length === 0 && !agentThinking) return null;

  let text: string;
  if (agentThinking && typingUsers.length === 0) {
    text = "Agent is thinking";
  } else if (typingUsers.length === 1) {
    text = `${typingUsers[0].displayName} is typing`;
  } else if (typingUsers.length === 2) {
    text = `${typingUsers[0].displayName} and ${typingUsers[1].displayName} are typing`;
  } else if (typingUsers.length > 2) {
    text = `${typingUsers.length} people are typing`;
  } else {
    text = "Agent is thinking";
  }

  return (
    <div className="flex items-center gap-2.5 px-2 py-1.5">
      <PulsingDots />
      <span className="text-xs text-neutral-400">{text}</span>
    </div>
  );
}
