"use client";

interface TypingIndicatorProps {
  typingUsers: { userId: string; displayName: string }[];
  agentThinking?: boolean;
}

function BouncingDots() {
  return (
    <div className="flex gap-[3px]">
      <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:0s]" />
      <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:0.2s]" />
      <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:0.4s]" />
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
    <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-neutral-500">
      <BouncingDots />
      {text}...
    </div>
  );
}
