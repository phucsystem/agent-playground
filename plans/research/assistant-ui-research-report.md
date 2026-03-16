# assistant-ui Multi-User Group Messaging Research Report

**Date:** March 2026
**Scope:** Feasibility of using assistant-ui for multi-user group chat (human-to-human + AI)
**Conclusion:** ⚠️ **Limited viability. Design philosophy conflicts with group messaging requirements.**

---

## Executive Summary

assistant-ui is **NOT designed for multi-user group messaging**. It is a React UI library for **single-user, conversational AI chat** (user ↔ AI patterns). While technically you could build a workaround using `ExternalStoreRuntime` + custom message handling, you would be fighting the framework's core design assumptions. This creates technical debt and fragility.

**Recommendation:** Do not use assistant-ui as the primary group chat UI. Consider it only for rendering AI responses within a custom group chat container.

---

## Finding 1: Message Role Constraint (CRITICAL)

### Current Limitation
`ThreadMessageLike` **only supports 3 roles**: `"user"`, `"assistant"`, `"system"`.

**Source:** [Support additional role types for ThreadMessageLike · Issue #2143](https://github.com/assistant-ui/assistant-ui/issues/2143)

### Implication for Group Chat
- Cannot distinguish between multiple human participants (Alice, Bob, Charlie).
- All humans must map to a single `"user"` role.
- No `"moderator"`, `"bot"`, or custom role types.
- Community has requested arbitrary role support but maintainers focus only on roles LLM providers officially support.

### Status
Issue closed November 28, 2025 (COMPLETED) — suggests either implemented or rejected definitively. Current docs still show only 3 roles.

### Workaround
You could store participant identity in message metadata:
```typescript
{
  role: "user",
  content: [{ type: "text", text: "Hello" }],
  metadata: {
    userId: "user-123",
    username: "alice"
  }
}
```
**But:** The UI has no built-in rendering for multi-participant identity — you'd need custom Message components.

---

## Finding 2: ExternalStoreRuntime - Flexible but Underdocumented

### What It Does
`ExternalStoreRuntime` bridges your state management (Redux, Zustand, etc.) with assistant-ui components. You maintain full control over message persistence and synchronization.

**Source:** [ExternalStoreRuntime | assistant-ui](https://www.assistant-ui.com/docs/runtimes/custom/external-store)

### Adapter Interface
```typescript
ExternalStoreAdapter<TMessage> {
  // Required
  messages: TMessage[];
  onNew: (message: AppendMessage) => Promise<void>;
  convertMessage: (msg: TMessage) => ThreadMessageLike;

  // Optional (enables specific UI features)
  setMessages?: (messages: TMessage[]) => void;         // branch switching
  onEdit?: (message: AppendMessage) => Promise<void>;   // message editing
  onReload?: (parentId: string | null, config) => Promise<void>; // regeneration
  onCancel?: () => Promise<void>;                        // cancel generation
}
```

### Capability: Custom Message Sources ✅
**YES.** You can feed messages from:
- Database queries
- Supabase Realtime subscriptions
- WebSocket streams
- Custom APIs

The `convertMessage` callback transforms your format → `ThreadMessageLike`.

### Capability: Realtime Synchronization
The adapter's `messages` array is reactive. If you update state via Supabase Realtime or WebSocket, just re-render the component and it picks up the new messages. No built-in realtime subscription handling — you manage this in your state layer.

### Reality Check: Documentation Gap
[Is usage of the `external-store` runtime fully documented? · Issue #1838](https://github.com/assistant-ui/assistant-ui/issues/1838)

User reported that while examples exist, they are "far from complete." Maintainer acknowledged and accepted PR to improve docs. **Implication:** You'll likely need to read source code or reverse-engineer from examples.

---

## Finding 3: Thread/ThreadList Components - Single-User Bias

### What ThreadList Does
Displays a list of conversations and lets users switch between them.

**Source:** [Custom Thread List | assistant-ui](https://www.assistant-ui.com/docs/runtimes/custom/custom-thread-list)

### Multi-Conversation Support ✅ YES
- Each thread is a separate conversation.
- ThreadList can handle thread switching.
- You define thread metadata (title, archive status, id).

### Multi-Participant Support ❌ NO
- Thread metadata adapter focuses on thread properties, not participant lists.
- No built-in notion of "thread members" or "access control per thread."
- The documentation example shows basic operations: rename, archive, delete, fetch.
- **No mention of participant management, permissions, or collaborative features.**

**Source:** [Custom Thread List | assistant-ui](https://www.assistant-ui.com/docs/runtimes/custom/custom-thread-list)

### What You'd Have to Build
- Track thread → participant mappings in your own database.
- Enforce access control at the UI level (component-level filtering).
- No framework support for "invite user to thread" or "remove user from thread" flows.

---

## Finding 4: Can You Have Multiple User Identities?

### Short Answer: Not natively.

### The Problem
The role-based system (`"user"`, `"assistant"`, `"system"`) doesn't support multiple distinct user identities. All humans must map to `"user"`.

### Workaround via Metadata + Custom Rendering
```typescript
// In convertMessage callback
{
  role: "user",
  content: [{ type: "text", text: "Hello everyone!" }],
  metadata: {
    userId: "alice-123",
    username: "Alice",
    avatar: "https://..."
  }
}
```

Then in your custom Message component, render from metadata:
```tsx
function CustomMessage({ message }) {
  const { userId, username } = message.metadata || {};
  return (
    <div>
      <strong>{username || "Unknown"}</strong>
      <p>{message.content[0].text}</p>
    </div>
  );
}
```

### Limitation
- You're bypassing assistant-ui's built-in message rendering.
- No out-of-the-box support for participant avatars, read receipts, typing indicators per user.
- Every multi-user feature requires custom component work.

---

## Finding 5: Message Metadata & Custom Fields

### Available as of January 2025
```typescript
ThreadMessageLike {
  role: "user" | "assistant" | "system";
  content: MessagePartPrimitive[];
  metadata?: {
    // Any custom fields you want
    userId?: string;
    author?: string;
    timestamp?: number;
    // ... your fields
    unstable_annotations?: unknown[];
    unstable_data?: unknown[];
  };
}
```

**Source:** [AI SDK UI: Message Metadata](https://ai-sdk.dev/docs/ai-sdk-ui/message-metadata)

### Data Message Parts
You can also attach structured data to messages:
```typescript
{
  type: "data-workflow",
  data: { /* your custom object */ }
}
```

### Reality
- Metadata is preserved through conversions.
- But the built-in UI components (Message, MessageList) don't know how to render it.
- You must override Message rendering to use metadata fields.

---

## Finding 6: Architecture & Design Philosophy

### Core Architecture
assistant-ui consists of:
1. **Frontend Components** — Shadcn UI chat components
2. **Runtime Layer** — React state management (LocalRuntime or ExternalStoreRuntime)
3. **Backend Integration** — Adapters to AI providers (OpenAI, Claude, LangGraph, etc.)

**Source:** [Architecture | assistant-ui](https://www.assistant-ui.com/docs/architecture)

### Design Philosophy: Single-User, Conversational AI
All 12 official examples are **single-user patterns**:
- ChatGPT/Claude clones
- Form-filling co-pilots
- Artifact generators
- Mem0 memory-augmented chat
- LangGraph stockbroker

**Zero examples for:**
- Multi-user group chat
- Human-to-human messaging
- Custom database message sources (except AI backends)
- Participant management

**Source:** [Examples | assistant-ui](https://www.assistant-ui.com/examples)

### Why This Matters
The entire component hierarchy assumes: **User sends message → AI responds → Thread grows**.

Breaking this (e.g., multiple humans sending messages, no AI involvement) requires:
- Custom message rendering
- Custom input handling
- Custom state management
- Disabling built-in features (auto-scroll behavior assumes AI-is-responder pattern)

---

## Finding 7: Runtime Options Summary

| Runtime | Use Case | Multi-User Friendly |
|---------|----------|-------------------|
| **LocalRuntime** | Simple AI chat with built-in state | ❌ No |
| **ExternalStoreRuntime** | Your state management (Redux/Zustand) | ⚠️ Possible but manual |
| **Vercel AI SDK** | OpenAI/Anthropic integration | ❌ No |
| **LangGraph** | Agent workflows | ❌ No |
| **Mastra** | Multi-agent orchestration | ❌ No |

**Conclusion:** No runtime is designed for group chat. `ExternalStoreRuntime` gives maximum flexibility but doesn't solve multi-user rendering or role limitations.

---

## Finding 8: GitHub Issues Reveal Real-World Pain Points

### Issue #2603: ExternalStoreRuntime / isRunning Doesn't Work With Messages
Users report bugs where the runtime's `isRunning` flag breaks when messages exist. Suggests edge cases in the implementation.

**Source:** [ExternalStoreRuntime / isRunning doesn't work when there are messages · Issue #2603](https://github.com/assistant-ui/assistant-ui/issues/2603)

### Issue #2292: Thread Creation Broken With RemoteThreadListRuntime
New thread functionality broke after v0.10.32. **Implication:** Even documented features have stability issues when combined.

**Source:** [New Thread Functionality No Longer Works with RemoteThreadListRuntime since 0.10.32 · Issue #2292](https://github.com/assistant-ui/assistant-ui/issues/2292)

### Issue #2143: Custom Role Types Requested But Not Implemented
Community asked for arbitrary role types (e.g., for LangGraph's "ai"/"human" roles). Maintainer's stance: only support roles that LLM providers officially support. No timeline for custom roles.

**Source:** [Support additional role types for ThreadMessageLike · Issue #2143](https://github.com/assistant-ui/assistant-ui/issues/2143)

---

## Finding 9: What Supabase Realtime + assistant-ui Would Look Like

### Can it be done?
Technically yes, with heavy custom work:

```typescript
import { useEffect, useState } from "react";
import { useExternalStoreRuntime } from "@assistant-ui/react";
import { supabase } from "./supabase";

export function GroupChatRuntime() {
  const [messages, setMessages] = useState([]);

  // Subscribe to Supabase Realtime changes
  useEffect(() => {
    const channel = supabase
      .channel("group-chat-messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = {
            id: payload.new.id,
            role: "user", // ALL humans map here
            content: [{ type: "text", text: payload.new.content }],
            metadata: {
              userId: payload.new.user_id,
              username: payload.new.username,
              timestamp: payload.new.created_at,
            },
          };
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => channel.unsubscribe();
  }, []);

  const runtime = useExternalStoreRuntime({
    messages,
    onNew: async (message) => {
      // Insert to DB
      await supabase.from("messages").insert({
        content: message.content[0].text,
        role: "user",
        user_id: currentUserId,
        username: currentUsername,
      });
    },
    setMessages,
    convertMessage: (msg) => msg, // Already ThreadMessageLike
  });

  return <AssistantUIContent runtime={runtime} />;
}
```

### Limitations
- All humans still appear as `role: "user"`.
- You must render participant info from metadata.
- assistant-ui's default Message component doesn't know about username/avatar.
- You're essentially using assistant-ui as a styled message list, not its full feature set.

---

## Finding 10: Unresolved Design Conflicts

### Conflict 1: AI-Centric Message Flow
assistant-ui assumes: User sends → AI responds.
Group chat reality: Humans send → Humans receive (AI optional).

**Impact:** Auto-scroll, loading states, input handling all optimized for AI response pattern.

### Conflict 2: Role Rigidity
Three roles only. Group chat needs:
- Multiple distinct human identities (not just "user")
- Optional bot/moderator roles
- Possible custom roles for specialized participants

**Impact:** Requires metadata + custom rendering, defeats purpose of using a UI library.

### Conflict 3: Thread Isolation
ThreadList manages separate conversations, but no notion of thread membership. All users see all threads (or you must filter at component level, losing framework benefits).

**Impact:** No access control or visibility management at the framework level.

### Conflict 4: Documentation & Stability
ExternalStoreRuntime is the only option for custom sources, but:
- Documentation gaps (users reading source code)
- Known bugs with isRunning flag and message state
- Thread creation breaks between minor versions

**Impact:** Risk of investing in a partially-documented, unstable feature.

---

## Alternatives Considered

### Build Custom UI on Supabase Realtime
- **Pros:** Full control, no framework constraints, mature Realtime API
- **Cons:** More code upfront, must build all UI from scratch
- **Verdict:** More work but fewer conflicts than forcing assistant-ui

### Use a Group Chat Library (if available)
- Libraries exist for group messaging (LangChain agent-chat-ui, BoodleBox, etc.) but are less polished than assistant-ui for single-user AI.
- **Verdict:** Worth exploring but less mature ecosystem.

### Hybrid Approach
- Use a dedicated group chat component for message display/input
- Embed assistant-ui only for AI responses (separate panel)
- **Verdict:** Best practical compromise if you want assistant-ui benefits for AI only.

---

## Recommendations

### ❌ DO NOT
- Use assistant-ui as the primary/only chat UI for multi-user group messaging.
- Expect built-in support for participant identity, roles, or access control.
- Build on ExternalStoreRuntime expecting it to remain stable or well-documented.
- Assume role limitation will be lifted soon (maintainer shows no urgency).

### ⚠️ CONDITIONAL
- **IF** you want assistant-ui for AI-only responses in a hybrid UI:
  - Use ExternalStoreRuntime + custom message component.
  - Keep group chat UI separate.
  - Use metadata for participant identity.
  - Expect to maintain custom rendering code.

### ✅ DO
- If group messaging is core: Build custom UI using Supabase Realtime + React.
- Evaluate whether you actually need a full chat UI or just message rendering + history.
- Test ExternalStoreRuntime early if you pursue hybrid approach (expect instability).
- Monitor GitHub issues for role/metadata improvements (unlikely but possible).

---

## Unresolved Questions

1. **Does `convertMessage` callback support async?** Docs unclear; seems synchronous only.
2. **How does thread isolation work with ExternalStoreRuntime + database?** Thread switching behavior undocumented.
3. **Will arbitrary message roles ever be supported?** Maintainer's philosophy suggests no, but no official closure.
4. **What's the stability roadmap for ExternalStoreRuntime?** Known bugs exist; no ETA on fixes.
5. **Can metadata fields be indexed/queried at the component level?** Not documented.

---

## Sources

- [ExternalStoreRuntime | assistant-ui](https://www.assistant-ui.com/docs/runtimes/custom/external-store)
- [Picking a Runtime | assistant-ui](https://www.assistant-ui.com/docs/runtimes/pick-a-runtime)
- [LocalRuntime | assistant-ui](https://www.assistant-ui.com/docs/runtimes/custom/local)
- [Custom Thread List | assistant-ui](https://www.assistant-ui.com/docs/runtimes/custom/custom-thread-list)
- [Architecture | assistant-ui](https://www.assistant-ui.com/docs/architecture)
- [Examples | assistant-ui](https://www.assistant-ui.com/examples)
- [Support additional role types for ThreadMessageLike · Issue #2143 · assistant-ui/assistant-ui](https://github.com/assistant-ui/assistant-ui/issues/2143)
- [Is usage of the `external-store` runtime fully documented anywhere? · Issue #1838 · assistant-ui/assistant-ui](https://github.com/assistant-ui/assistant-ui/issues/1838)
- [ExternalStoreRuntime / isRunning doesn't work when there are messages · Issue #2603 · assistant-ui/assistant-ui](https://github.com/assistant-ui/assistant-ui/issues/2603)
- [New Thread Functionality No Longer Works with RemoteThreadListRuntime since 0.10.32 · Issue #2292 · assistant-ui/assistant-ui](https://github.com/assistant-ui/assistant-ui/issues/2292)
- [AI SDK UI: Message Metadata](https://ai-sdk.dev/docs/ai-sdk-ui/message-metadata)
- [GitHub - assistant-ui/assistant-ui: Typescript/React Library for AI Chat](https://github.com/assistant-ui/assistant-ui)
