# assistant-ui for Group Messaging: Quick Verdict

## TL;DR
**❌ NOT RECOMMENDED** for multi-user group chat. Framework designed for single-user AI conversations. Fundamental design conflicts make it a poor fit.

---

## Question-by-Question Answers

### 1. Can Thread/ThreadList handle multiple human participants?
**NO.** Only supports 3 roles: "user", "assistant", "system". All humans must map to "user" role. Issue #2143 requests arbitrary roles but maintainer shows no urgency. No way to distinguish Alice from Bob in UI without custom components.

### 2. Does it support custom message sources (Supabase Realtime)?
**YES, via ExternalStoreRuntime.** You provide `messages` array + `convertMessage` callback. Can wire to Supabase, database, WebSocket. But: documentation gaps, known bugs (isRunning flag), requires heavy custom work.

### 3. Can you build custom Runtime for database/realtime?
**YES, technically.** ExternalStoreRuntime lets you control state entirely. But: it's underdocumented (users report reading source code), has stability issues, was designed for Redux/Zustand state — not realtime subscriptions.

### 4. Any examples of assistant-ui for multi-user chat?
**NO.** All 12 official examples are single-user AI patterns. Zero community examples of group messaging. Strong signal it's out of scope.

### 5. What is ExternalStoreRuntime / custom runtime API?
```typescript
ExternalStoreAdapter {
  messages: TMessage[];
  onNew: (msg) => Promise<void>;
  convertMessage: (msg) => ThreadMessageLike;
  setMessages?: (msgs) => void;        // optional
  onEdit?: (msg) => Promise<void>;     // optional
  onReload?: (parentId) => Promise<void>;  // optional
  onCancel?: () => Promise<void>;      // optional
}
```
Can accept arbitrary message arrays. Can convert from any format via callback.

### 6. Can roles go beyond user/assistant? Multiple user identities?
**NO.** Hardcoded to 3 roles. Workaround: use message.metadata for userId/username but you must render custom components — defeats purpose of using a UI library.

### 7. Does ThreadList support multiple conversations?
**YES.** Thread switching works. But: no participant list per thread, no access control, no "invite user" features. You must track participants in your own DB.

---

## Hidden Costs of Using It

| Cost | Impact |
|------|--------|
| Role rigidity | Every group chat feature blocks on custom rendering |
| Underdocumented API | ExternalStoreRuntime requires source code reading |
| Stability risk | Known bugs in isRunning, thread creation; no fast fixes expected |
| No group features | Auto-scroll/input logic assumes single user sending |
| Metadata workarounds | Participant identity requires metadata + custom components |

---

## Better Alternatives

1. **Supabase Realtime + Custom React UI** — Full control, mature API, no framework conflicts
2. **Hybrid Approach** — Use assistant-ui for AI-only responses, separate UI for group chat
3. **LangChain agent-chat-ui** — More flexible agent/multi-user support (less polished)

---

## Only Use assistant-ui If

- You want it **only for AI responses** in a hybrid UI.
- Human-to-human messaging is in a **separate component**.
- You're comfortable with **custom message rendering** for participant identity.
- You can **accept ExternalStoreRuntime stability risk**.

---

## Key GitHub Issues

- [#2143: Custom roles requested](https://github.com/assistant-ui/assistant-ui/issues/2143) (no progress)
- [#1838: ExternalStoreRuntime docs gap](https://github.com/assistant-ui/assistant-ui/issues/1838) (acknowledged, slow to fix)
- [#2603: isRunning bug with messages](https://github.com/assistant-ui/assistant-ui/issues/2603) (known issue)
- [#2292: Thread creation broken after v0.10.32](https://github.com/assistant-ui/assistant-ui/issues/2292) (stability concern)

---

## Recommendation

**If group messaging is core to your feature:** Do not use assistant-ui as primary chat UI.

**If you only need it for AI responses:** Use ExternalStoreRuntime + test early for stability.

**If unsure:** Prototype with Supabase Realtime first. It's easier to add assistant-ui later than to rip it out.
