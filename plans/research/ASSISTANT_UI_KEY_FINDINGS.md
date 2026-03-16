# assistant-ui: Key Findings Summary

## Quick Reference for Multi-User Group Messaging Investigation

---

## Finding 1: Role Constraint (BLOCKER)
**Only 3 roles:** "user", "assistant", "system"
- Cannot distinguish multiple humans (Alice, Bob, Charlie)
- Cannot add custom roles like "moderator" or "bot"
- **Workaround:** Store userId/username in message.metadata
- **Status:** Issue #2143 requested arbitrary roles; maintainer shows no urgency

---

## Finding 2: ExternalStoreRuntime (POSSIBLE)
Bridges your state (Redux/Zustand/database) to UI components

**Interface:**
```typescript
{
  messages: TMessage[],
  onNew: (msg) => Promise<void>,
  convertMessage: (msg) => ThreadMessageLike,
  setMessages?: (msgs) => void,
  onEdit?: (msg) => Promise<void>,
  onReload?: (parentId) => Promise<void>,
  onCancel?: () => Promise<void>
}
```

**Supports:** Arbitrary message formats via convertMessage callback
**Real-world:** Can wire to Supabase, database, WebSocket
**Reality:** Documentation gaps, users reading source code (Issue #1838)

---

## Finding 3: Thread/ThreadList (PARTIAL)
- ✅ Thread switching works
- ✅ Multiple conversations supported
- ❌ No participant list per thread
- ❌ No access control or invite features
- You must track participants in your own DB

---

## Finding 4: Message Metadata (WORKAROUND AVAILABLE)
Can attach custom fields:
```typescript
{
  role: "user",
  content: [{ type: "text", text: "..." }],
  metadata: {
    userId: "user-123",
    username: "Alice",
    avatar: "https://...",
    customField: "value"
  }
}
```

**Limitation:** Built-in UI components don't render metadata. You need custom Message component.

---

## Finding 5: Design Philosophy (FUNDAMENTAL MISMATCH)
assistant-ui is built for: **User ↔ AI single-user conversation**

All 12 official examples are single-user:
- ChatGPT/Claude clones
- Form-filling co-pilots
- Memory-augmented chat
- LangGraph agent workflows

**Zero examples for:** Multi-user group chat, human-to-human messaging, custom message sources

---

## Finding 6: Known Issues (STABILITY CONCERN)
- **#2603:** ExternalStoreRuntime's isRunning flag breaks with messages
- **#2292:** Thread creation broken after v0.10.32
- **#2143:** Custom roles requested but not implemented
- **#1838:** ExternalStoreRuntime documentation incomplete

---

## Finding 7: What You'd Have to Build
To use assistant-ui for group chat:
- ✅ Custom Message component (metadata rendering)
- ✅ Custom input handling (no multi-user defaults)
- ✅ Participant tracking (not in framework)
- ✅ Access control (not in framework)
- ✅ Message history per thread (custom logic)
- ✅ Realtime subscription management (custom logic)

**Bottom line:** You're building 70% of the chat UI yourself.

---

## Can You Use It For...?

| Use Case | Possible | Ease | Recommendation |
|----------|----------|------|-----------------|
| **Full group chat UI** | ❌ No | N/A | ❌ Don't use |
| **Hybrid (group + AI)** | ✅ Yes | Medium | ⚠️ Architect 1 |
| **Custom message source** | ✅ Yes | High | ⚠️ ExternalStoreRuntime |
| **AI responses only** | ✅ Yes | Easy | ✅ Use it |
| **Thread switching** | ✅ Yes | Easy | ✅ Works |
| **Multi-participant identity** | ⚠️ Maybe | Hard | ⚠️ Via metadata |

---

## The Cost-Benefit Tradeoff

### If You Use It
**Time investment:** Medium-high (custom Message component, state management, realtime wiring)
**Framework benefit:** Low (constraints outweigh help)
**Stability risk:** Medium (ExternalStoreRuntime has bugs, documentation gaps)

### If You Don't Use It
**Time investment:** Same or less (Supabase + React from scratch)
**Framework benefit:** None (but no constraints either)
**Stability risk:** Low (proven libraries: Supabase, React, Shadcn)

---

## Recommendations by Scenario

### "Group chat is core, AI optional"
→ **❌ Don't use assistant-ui**
→ ✅ Use Supabase Realtime + custom React UI

### "We want group chat + AI responses"
→ **⚠️ Hybrid approach (Architecture 1)**
→ Separate group chat UI + assistant-ui for AI only

### "Single-user AI chat, no group features"
→ **✅ Use assistant-ui** (it's designed for this)

### "Unsure yet, exploring options"
→ **✅ Prototype with Supabase first**
→ Add assistant-ui later if needed (easier than ripping it out)

---

## Key GitHub Issues to Monitor

| Issue | Status | Implication |
|-------|--------|------------|
| [#2143: Custom roles](https://github.com/assistant-ui/assistant-ui/issues/2143) | Closed, no progress | Roles locked to 3 types |
| [#1838: ExternalStoreRuntime docs](https://github.com/assistant-ui/assistant-ui/issues/1838) | Acknowledged, slow fix | Expect to read source code |
| [#2603: isRunning bug](https://github.com/assistant-ui/assistant-ui/issues/2603) | Known, not urgent | ExternalStoreRuntime unreliable |
| [#2292: Thread creation broken](https://github.com/assistant-ui/assistant-ui/issues/2292) | Stability concern | Minor version bumps break features |

---

## Sources Referenced

- [ExternalStoreRuntime docs](https://www.assistant-ui.com/docs/runtimes/custom/external-store)
- [Runtime options](https://www.assistant-ui.com/docs/runtimes/pick-a-runtime)
- [Custom Thread List](https://www.assistant-ui.com/docs/runtimes/custom/custom-thread-list)
- [Architecture](https://www.assistant-ui.com/docs/architecture)
- [Examples](https://www.assistant-ui.com/examples)
- GitHub issues #2143, #1838, #2603, #2292
- [AI SDK UI Message Metadata](https://ai-sdk.dev/docs/ai-sdk-ui/message-metadata)

---

## Decision Checklist

Before choosing assistant-ui for group chat, ask:

- [ ] Is group messaging the primary feature or secondary?
  - Primary? → Don't use assistant-ui
  - Secondary? → Consider hybrid approach

- [ ] Are you comfortable with custom component development?
  - No? → Don't use assistant-ui
  - Yes? → Evaluate effort vs. benefit

- [ ] Can you tolerate ExternalStoreRuntime stability issues?
  - No? → Don't use assistant-ui
  - Yes? → Hybrid approach only

- [ ] Do you actually need assistant-ui's features (editing, regeneration, branching)?
  - No? → Use Shadcn Chat + Supabase directly
  - Yes? → Only for AI responses, not group chat

- [ ] Will your team understand the architecture (10% assistant-ui, 90% custom)?
  - No? → Don't use assistant-ui
  - Yes? → Proceed with caution

**If you answered "No" to any question:** Build custom UI. You'll save time and pain.
