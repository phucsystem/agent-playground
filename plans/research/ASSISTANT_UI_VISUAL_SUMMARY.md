# assistant-ui for Group Chat: Visual Summary

---

## Answer to Each Research Question

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Can Thread/ThreadList handle multiple humans?            │
│                                                             │
│    ❌ NO - Only 3 roles: "user", "assistant", "system"     │
│            All humans must map to "user" role              │
│            No way to distinguish Alice from Bob             │
│                                                             │
│    ⚠️  Workaround: Store userId/username in metadata       │
│        But requires custom Message component               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 2. Support custom message sources (DB, Supabase)?           │
│                                                             │
│    ✅ YES - ExternalStoreRuntime + convertMessage callback │
│            Can wire to any message source                   │
│                                                             │
│    ⚠️  Reality: Documentation gaps, users read source code │
│        Known bugs: isRunning flag breaks with messages     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 3. Can you build custom Runtime?                            │
│                                                             │
│    ✅ YES - Via ExternalStoreRuntime adapter               │
│            Full control over state management               │
│            Can feed arbitrary message arrays                │
│                                                             │
│    ⚠️  But: Designed for Redux/Zustand, not realtime      │
│        Stability concerns with multi-message scenarios      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 4. Examples of multi-user chat?                             │
│                                                             │
│    ❌ NO - 12 official examples, all single-user AI        │
│            - ChatGPT/Claude clones                          │
│            - Form-filling co-pilots                         │
│            - Mem0 memory chat                               │
│            - LangGraph agents                               │
│                                                             │
│    Zero community examples for group messaging              │
│    Clear signal: Out of scope for this library              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 5. What is ExternalStoreRuntime API?                        │
│                                                             │
│    ExternalStoreAdapter<TMessage> {                         │
│      // Required                                            │
│      messages: TMessage[];                                  │
│      onNew: (msg) => Promise<void>;                         │
│      convertMessage: (msg) => ThreadMessageLike;            │
│                                                             │
│      // Optional - enables specific features                │
│      setMessages?: (msgs) => void;         // branching    │
│      onEdit?: (msg) => Promise<void>;      // editing      │
│      onReload?: (parentId) => Promise<void>; // regen      │
│      onCancel?: () => Promise<void>;       // cancel       │
│    }                                                        │
│                                                             │
│    ✅ Can accept arbitrary message arrays                   │
│    ✅ Can convert from any format via callback              │
│    ⚠️  But underdocumented and has stability issues        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 6. Can roles go beyond user/assistant? Multiple IDs?        │
│                                                             │
│    ❌ NO - Hardcoded to 3 roles only                       │
│            Issue #2143 requested custom roles              │
│            Maintainer shows no urgency                      │
│                                                             │
│    ⚠️  Workaround: Use message.metadata                    │
│        metadata: { userId, username, avatar }              │
│        Must implement custom Message component             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 7. ThreadList - multiple conversations?                     │
│                                                             │
│    ✅ YES - Thread switching works fine                    │
│    ✅ Multiple conversations supported                      │
│                                                             │
│    ❌ NO - No participant list per thread                  │
│           No access control or invite features              │
│           Must track in your own database                   │
└─────────────────────────────────────────────────────────────┘
```

---

## The Fundamental Problem

```
┌────────────────────────────────────────────────────────────┐
│ What assistant-ui is built for:                            │
│                                                            │
│            User Message                                    │
│                  ↓                                          │
│            assistant-ui                                    │
│                  ↓                                          │
│            AI Response                                     │
│                                                            │
│    Framework: Single-user ↔ AI conversation               │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ What you need for group chat:                              │
│                                                            │
│    Alice: "Hello"                                          │
│      ↓                                                      │
│    Bob: "Hi there"                                         │
│      ↓                                                      │
│    Charlie: "What's up?"                                   │
│      ↓                                                      │
│    AI: "I can help with..."                                │
│      ↓                                                      │
│    Alice: "Thanks!"                                        │
│                                                            │
│    Framework: Multi-user + optional AI                    │
└────────────────────────────────────────────────────────────┘

             ❌ MISMATCH - Framework unfit for use case
```

---

## The Role Problem (Most Critical)

```
┌─────────────────────────────────┐
│ What assistant-ui sees:         │
├─────────────────────────────────┤
│ Message 1: role: "user"         │
│   "Hello everyone"              │
│                                 │
│ Message 2: role: "user"         │
│   "Hi there"                    │
│                                 │
│ Message 3: role: "assistant"    │
│   "Hello! How can I help?"      │
└─────────────────────────────────┘

Problem: Messages 1 & 2 are indistinguishable
         Both are "user" role
         No way to render "Alice said..." vs "Bob said..."

┌────────────────────────────────────────────────┐
│ What you want to render:                       │
├────────────────────────────────────────────────┤
│ Alice: "Hello everyone"                        │
│ Bob: "Hi there"                                │
│ Assistant: "Hello! How can I help?"            │
└────────────────────────────────────────────────┘

Workaround: Store identity in metadata
┌──────────────────────────────────────┐
│ role: "user",                        │
│ content: [{ type: "text", ... }],    │
│ metadata: {                          │
│   userId: "alice-123",               │
│   username: "Alice",        ← Not part of official UI
│   avatar: "https://..."     ← You must render this
│ }                                    │
└──────────────────────────────────────┘

Cost: Custom Message component, custom rendering logic
```

---

## Time Comparison

```
╔════════════════════════════════════════════════╗
║ Option A: Use assistant-ui                    ║
╠════════════════════════════════════════════════╣
║                                               ║
║  ✓ Setup ExternalStoreRuntime            1hr ║
║  ✓ Wire Supabase Realtime subscription   2hr ║
║  ✓ Custom Message component (metadata)   3hr ║
║  ✓ Custom input handling                 2hr ║
║  ✓ Thread/participant management         2hr ║
║  ✓ Testing & debugging                   3hr ║
║                                               ║
║  Total: ~13 hours                            ║
║  Stability risk: HIGH (bugs, documentation)  ║
║                                               ║
╚════════════════════════════════════════════════╝

╔════════════════════════════════════════════════╗
║ Option B: Build custom UI                    ║
╠════════════════════════════════════════════════╣
║                                               ║
║  ✓ Supabase Realtime setup               1hr ║
║  ✓ Message list component                2hr ║
║  ✓ Input component                       1hr ║
║  ✓ State management (Zustand/Redux)      2hr ║
║  ✓ Thread/participant management         2hr ║
║  ✓ Testing & debugging                   2hr ║
║                                               ║
║  Total: ~10 hours                            ║
║  Stability risk: LOW (proven libraries)      ║
║                                               ║
╚════════════════════════════════════════════════╝

✅ Option B is FASTER and LESS RISKY
```

---

## GitHub Issues Timeline

```
Jan 2023  Issue #2143: Request custom roles
          ↓
          Maintainer: "We only support roles LLM providers use"
          ↓
Nov 2025  Issue closed: COMPLETED (but no actual change)
          ↓
          Status: Still 3 roles only

          ⚠️ SIGNAL: Not a priority for maintainers

April 2024  Issue #1838: "Is external-store runtime documented?"
            ↓
            User: "Documentation very incomplete"
            ↓
            Maintainer: "We accept PRs to improve docs"
            ↓
            Status: Slow progress, users still reading source code

            ⚠️ SIGNAL: Documentation gaps persist

March 2025  Issue #2603: ExternalStoreRuntime isRunning bug
            ↓
            Status: Known issue, not urgent
            ↓
            Impact: Feature breaks in real-world usage

            ⚠️ SIGNAL: Stability issues not prioritized

March 2025  Issue #2292: Thread creation broken v0.10.32
            ↓
            Status: Even documented features break
            ↓
            Impact: Minor version bumps can be breaking

            ⚠️ SIGNAL: Stability risk across upgrades
```

---

## Recommended Architectures

```
┌─────────────────────────────────────────────────┐
│ Architecture 1: Hybrid UI (RECOMMENDED)          │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ GROUP CHAT (Custom React Component)     │   │
│  │ ─────────────────────────────────────── │   │
│  │ Alice: "What's the weather?"            │   │
│  │ Bob: "Good question"                    │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ AI RESPONSE (assistant-ui Component)    │   │
│  │ ─────────────────────────────────────── │   │
│  │ Assistant: "It's sunny and warm..."     │   │
│  │ [Edit] [Regenerate] [Copy]              │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  State: Shared Zustand store                   │
│  Database: Supabase (messages table)            │
│  Realtime: Supabase Realtime subscriptions     │
│                                                 │
│  ✅ Pros: Clean separation, minimal constraints │
│  ✅ Cons: Two components to manage              │
│                                                 │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Architecture 2: Full assistant-ui w/ Workarounds │
├─────────────────────────────────────────────────┤
│                                                 │
│  Single message list (assistant-ui)             │
│  + ExternalStoreRuntime adapter                 │
│  + Custom Message component (metadata)          │
│  + Metadata: { userId, username, avatar }       │
│                                                 │
│  ❌ Pros: Centralized UI                        │
│  ❌ Cons: Fighting framework constraints        │
│  ❌ Cons: Complex state management              │
│  ❌ Cons: Stability risk (ExternalStoreRuntime) │
│                                                 │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Architecture 3: Minimal assistant-ui            │
├─────────────────────────────────────────────────┤
│                                                 │
│  Message/MessageList components only            │
│  (treat as styling library, not framework)      │
│                                                 │
│  ❌ Pros: No runtime constraints                │
│  ❌ Cons: Why use assistant-ui at all?          │
│  ❌ Cons: Shadcn Chat is available standalone   │
│                                                 │
└─────────────────────────────────────────────────┘

✅ RECOMMENDATION: Architecture 1 (Hybrid UI)
   If you need assistant-ui benefits, keep it separate.
```

---

## Decision Tree

```
                    GROUP CHAT IS CORE?
                           │
                ┌──────────┴──────────┐
                │                     │
               YES                    NO (AI-only)
                │                     │
          Don't use         assistant-ui perfect fit ✅
          assistant-ui        USE IT

          Instead use:
          • Supabase Realtime
          • Custom React UI
          • Faster, cleaner, less risk


                    GROUP CHAT IS CORE?
                           │
              ┌────────────┴────────────┐
              │                         │
             YES          HYBRID (group + AI)?
              │                    │
              │           ┌────────┴────────┐
              │          YES                NO
              │           │                  │
              │      Arch 1:           Custom UI
              │      Hybrid UI       (no assistant-ui)
              │      (recommended)
              │           │
              │      Expect:
              │      ✅ Feasible
              │      ✅ Architecturally clean
              │      ⚠️ Custom components
              │      ⚠️ Both UI systems to maintain
              │
         Don't use assistant-ui
         Build custom UI instead

         • Faster (10 vs 13 hrs)
         • Fewer constraints
         • Better community support
         • Lower risk
```

---

## The Honest Assessment

```
┌──────────────────────────────────────────────────┐
│ What You're Getting If You Use assistant-ui:    │
├──────────────────────────────────────────────────┤
│                                                  │
│ ✅ Composable primitives                        │
│ ✅ Good accessibility defaults                  │
│ ✅ Streaming support (but for AI only)          │
│ ✅ Tool UI rendering                            │
│ ✅ Message editing + regeneration (AI)          │
│                                                  │
│ ❌ Role constraint (can't fix)                  │
│ ❌ Documentation gaps (ExternalStoreRuntime)    │
│ ❌ Stability issues (known bugs)                │
│ ❌ No group chat features                       │
│ ❌ Must build 70% custom anyway                 │
│                                                  │
│ VERDICT: 20% benefit, 80% workaround            │
│                                                  │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ What You're Getting Building Custom UI:        │
├──────────────────────────────────────────────────┤
│                                                  │
│ ✅ Full control over architecture               │
│ ✅ No framework constraints                     │
│ ✅ Clear participant identity                   │
│ ✅ Easy Supabase integration                    │
│ ✅ Mature dependencies (React, Supabase)        │
│ ✅ Faster time to market                        │
│ ✅ Lower risk                                    │
│                                                  │
│ ❌ Must build from scratch (more initial code)  │
│ ❌ More responsibility on you                   │
│                                                  │
│ VERDICT: 100% control, 0% workaround            │
│                                                  │
└──────────────────────────────────────────────────┘

           ✅ CUSTOM UI WINS
```

---

## Files in This Research

```
assistant-ui-research-report.md (12 pages)
├─ Full analysis with sources
├─ All 10 findings with context
├─ GitHub issues deep dive
└─ Architecture overview

ASSISTANT_UI_VERDICT.md (2 pages) ← START HERE
├─ Yes/no answers to your 7 questions
├─ Quick verdict
└─ GitHub issues table

ASSISTANT_UI_KEY_FINDINGS.md (3 pages)
├─ 7 findings (condensed)
├─ Use case table
├─ Recommendations by scenario
└─ Decision checklist

ASSISTANT_UI_FEASIBLE_ARCHITECTURES.md (8 pages)
├─ Architecture 1: Hybrid UI (RECOMMENDED)
├─ Architecture 2: Full assistant-ui
├─ Architecture 3: Minimal UI
└─ Implementation examples

ASSISTANT_UI_RESEARCH_INDEX.md (navigation)
├─ How to read this research
├─ Navigation by question
└─ Action items

THIS FILE: ASSISTANT_UI_VISUAL_SUMMARY.md
```

---

## Bottom Line

```
USE IF:                          DON'T USE IF:
────────────                     ──────────
Single-user AI chat       ←→     Group messaging is core
AI responses only         ←→     Need multi-user identity
Chat with LLMs           ←→     Humans talking to humans
Editing/regeneration     ←→     Messages are read-only

     ✅ Perfect fit             ❌ Poor fit, avoid it
```

If you choose to use assistant-ui anyway, read **ASSISTANT_UI_FEASIBLE_ARCHITECTURES.md** for implementation guidance.

Otherwise, build custom UI with Supabase. Faster, cleaner, less risky.

---

*Complete research: March 2026*
*Recommendation: Build custom UI for group chat. Add assistant-ui for AI responses if needed later.*
