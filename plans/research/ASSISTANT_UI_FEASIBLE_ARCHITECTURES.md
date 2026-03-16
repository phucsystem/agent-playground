# assistant-ui + Group Chat: Feasible Architectures

If you decide to use assistant-ui despite its limitations, here are 3 realistic approaches.

---

## Architecture 1: Hybrid UI (RECOMMENDED IF USING ASSISTANT-UI)

Use assistant-ui **only for AI responses**. Group chat in separate component.

### Layout
```
┌─────────────────────────────────────┐
│ GROUP CHAT MESSAGES                 │
│ (Custom component, Supabase state)  │
│                                     │
│ Alice: "What's the weather?"        │
│ Bob: "Good question"                │
│ AI Assistant: "It's sunny..."       │
│ (← assistant-ui renders this)       │
└─────────────────────────────────────┘
│ Input: [Text]  [Send] [AI Toggle]   │
└─────────────────────────────────────┘
```

### Tech Stack
- **Message List:** Custom React component (filter by sender, render avatars, timestamps)
- **AI Responses:** assistant-ui's MessageList component
- **State:** Zustand or Redux (single source of truth)
- **Database:** Supabase messages table (all messages: human + AI)
- **Realtime:** Supabase Realtime subscription

### Implementation Outline

```typescript
// store.ts
export const useMessages = create((set) => ({
  messages: [],
  addMessage: (msg) => set((state) => ({
    messages: [...state.messages, msg],
  })),
}));

// GroupChat.tsx
export function GroupChat() {
  const [aiEnabled, setAiEnabled] = useState(true);
  const messages = useMessages((s) => s.messages);
  const humanMessages = messages.filter((m) => m.type === "human");
  const aiMessages = messages.filter((m) => m.type === "ai");

  return (
    <div>
      {/* Custom message list for group chat */}
      <div className="message-list">
        {humanMessages.map((msg) => (
          <HumanMessage
            key={msg.id}
            username={msg.username}
            avatar={msg.avatar}
            content={msg.content}
            timestamp={msg.createdAt}
          />
        ))}
      </div>

      {/* assistant-ui for AI only */}
      {aiEnabled && (
        <div className="ai-section">
          <AssistantUIThread messages={aiMessages} />
        </div>
      )}

      {/* Input for both */}
      <ChatInput onSubmit={handleSendMessage} />
    </div>
  );
}
```

### Pros
- ✅ Minimal assistant-ui usage = minimal constraints
- ✅ Full control over group chat rendering
- ✅ Avoids role limitations (custom rendering for humans)
- ✅ Clean separation of concerns

### Cons
- ❌ You're building most of the chat UI anyway
- ❌ Synchronizing two message streams is manual work
- ❌ Limited assistant-ui benefit (could use raw components from Shadcn)

### Verdict
If you're going to do 70% custom UI, **reconsider whether assistant-ui adds value.**

---

## Architecture 2: Full assistant-ui with Workarounds

Use assistant-ui's full component set but work around limitations.

### Strategy
1. Use ExternalStoreRuntime to feed all messages (human + AI)
2. Extend message metadata with userId/username for human messages
3. Override Message component to render metadata

### Implementation

```typescript
// message-adapter.ts
export function createGroupChatAdapter(
  messages: Message[], // Your DB type
  setMessages: (msgs: Message[]) => void,
  currentUserId: string
) {
  return {
    messages,
    onNew: async (appendMsg) => {
      const newMsg = {
        id: crypto.randomUUID(),
        type: "human",
        content: appendMsg.content[0].text,
        userId: currentUserId,
        username: "You", // or fetch from auth
        createdAt: new Date(),
      };
      await supabase.from("messages").insert(newMsg);
      setMessages([...messages, newMsg]);
    },
    convertMessage: (msg: Message): ThreadMessageLike => {
      if (msg.type === "human") {
        return {
          role: "user", // All humans → "user" role
          content: [{ type: "text", text: msg.content }],
          metadata: {
            userId: msg.userId,
            username: msg.username,
            timestamp: msg.createdAt.toISOString(),
            humanMessage: true,
          },
        };
      } else {
        // AI message
        return {
          role: "assistant",
          content: [{ type: "text", text: msg.content }],
          metadata: {
            timestamp: msg.createdAt.toISOString(),
          },
        };
      }
    },
    setMessages,
    onEdit: async (editMsg) => {
      // Update in DB
      await supabase
        .from("messages")
        .update({ content: editMsg.content[0].text })
        .eq("id", editMsg.id);
    },
    onReload: async (parentId) => {
      // Regenerate AI response
      const parentMsg = messages.find((m) => m.id === parentId);
      if (parentMsg) {
        const aiResponse = await callAI(parentMsg.content);
        // Insert new AI message...
      }
    },
  };
}

// CustomMessage.tsx - Override default rendering
export function CustomMessage({ message }) {
  const metadata = message.metadata as {
    userId?: string;
    username?: string;
    timestamp?: string;
    humanMessage?: boolean;
  };

  if (metadata.humanMessage) {
    return (
      <div className="message human">
        <strong>{metadata.username}</strong>
        <p>{message.content[0]?.text}</p>
        <small>{metadata.timestamp}</small>
      </div>
    );
  }

  // Default AI message rendering
  return (
    <div className="message ai">
      <strong>Assistant</strong>
      <p>{message.content[0]?.text}</p>
    </div>
  );
}
```

### Pros
- ✅ Leverages assistant-ui's composition primitives
- ✅ Participant identity via metadata
- ✅ Can use assistant-ui's threading, editing, regeneration

### Cons
- ❌ Works around core limitation (role rigidity) with metadata hacks
- ❌ Still requires custom Message component (loses built-in styling)
- ❌ ExternalStoreRuntime stability risk
- ❌ All humans grouped as "user" role (confusing architecture)

### Verdict
This approach "works" but feels hacky. You're fighting the framework.

---

## Architecture 3: Minimal assistant-ui (Message Rendering Only)

Don't use assistant-ui's full runtime. Just use its Message/MessageList components for rendering.

### Strategy
- Manage all state yourself (Zustand, Redux, or Supabase directly)
- Use only Shadcn Chat components from assistant-ui (not the runtime)
- Treat assistant-ui as a styling library, not a framework

### Implementation

```typescript
// chat.tsx
import { Message, MessageList } from "@assistant-ui/react";
import { useSupabaseMessages } from "./hooks/useSupabaseMessages";

export function GroupChat() {
  const { messages, sendMessage } = useSupabaseMessages();
  const [input, setInput] = useState("");

  const handleSend = async () => {
    const newMsg = {
      id: crypto.randomUUID(),
      type: "human",
      content: input,
      userId: auth.currentUser.id,
      username: auth.currentUser.name,
      createdAt: new Date(),
    };
    await supabase.from("messages").insert(newMsg);
    setInput("");
  };

  return (
    <div>
      <MessageList>
        {messages.map((msg) => (
          <Message
            key={msg.id}
            role={msg.type === "ai" ? "assistant" : "user"}
            content={[{ type: "text", text: msg.content }]}
          >
            {/* Custom rendering for sender info */}
            <div className="message-header">
              {msg.type === "human" && (
                <>
                  <img src={msg.avatar} alt={msg.username} />
                  <span>{msg.username}</span>
                </>
              )}
              {msg.type === "ai" && <span>🤖 Assistant</span>}
            </div>
          </Message>
        ))}
      </MessageList>

      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
```

### Pros
- ✅ Avoids runtime complexity entirely
- ✅ Full state control (no ExternalStoreRuntime bugs)
- ✅ Participant identity rendered naturally
- ✅ Simplest architecture

### Cons
- ❌ Lose assistant-ui's features: message editing, regeneration, branching
- ❌ Why use assistant-ui at all? Shadcn Chat components are available standalone
- ❌ Minimal benefit over custom UI

### Verdict
At this point, you're better off using Shadcn Chat directly or a custom component. Not worth the assistant-ui dependency.

---

## Comparison Matrix

| Feature | Arch 1 | Arch 2 | Arch 3 |
|---------|--------|--------|--------|
| **Participant identity** | ✅ Custom UI | ⚠️ Metadata workaround | ✅ Custom UI |
| **Group features** | ✅ Full control | ⚠️ Partial (via assistantUI) | ✅ Full control |
| **ExternalStoreRuntime** | ❌ No | ✅ Yes | ❌ No |
| **Complexity** | Medium | High | Low |
| **Stability risk** | Low | High | Low |
| **assistant-ui value** | Low | Medium | None |
| **Recommended** | ✅ If using | ⚠️ Avoid | ❌ Don't use |

---

## Final Recommendation

### Scenario: You want group chat + occasional AI responses
→ **Architecture 1 (Hybrid)** — Separate UI for group, assistant-ui for AI only.

### Scenario: You're committed to assistant-ui
→ **Architecture 2** — Full assistant-ui with metadata workarounds (but expect pain).

### Scenario: You're flexible
→ **Architecture 3 OR Just Use Supabase + Shadcn Chat** — No assistant-ui needed.

---

## The Honest Take

If you're building multi-user group chat, **assistant-ui doesn't save you code**. It saves you code for single-user AI chat, which is outside your scope.

**Better path:**
1. Build group chat UI with Supabase Realtime + React
2. If you need AI responses later, evaluate assistant-ui then
3. Don't pre-optimize for a library that doesn't fit the problem

Time spent fighting assistant-ui's constraints = time you could have spent building custom UI that actually matches your requirements.
