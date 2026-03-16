# assistant-ui Multi-User Group Messaging Research Index

**Investigation Date:** March 2026
**Status:** ✅ Complete
**Conclusion:** ⚠️ **NOT RECOMMENDED** for multi-user group chat. Framework designed for single-user AI conversation.

---

## 📄 Documents in This Research

### 1. **ASSISTANT_UI_VERDICT.md** (Start here)
**Length:** 2 pages
**Purpose:** Quick yes/no answers to your 7 research questions

**Start reading if:** You need quick answers without deep technical detail
- Can it handle multiple human participants?
- Does it support custom message sources?
- Can you build a custom runtime?
- Examples of multi-user usage?
- ExternalStoreRuntime API?
- Multiple user identities?
- Thread/conversation switching?

---

### 2. **ASSISTANT_UI_KEY_FINDINGS.md** (Quick reference)
**Length:** 3 pages
**Purpose:** Condensed summary of all findings with decision checklist

**Start reading if:** You want key facts, not full analysis
- 7 critical findings (each 1-2 paragraphs)
- Use cases table (multi-user chat, hybrid, AI-only)
- Recommendations by scenario
- GitHub issues to monitor
- Decision checklist (5 questions)

---

### 3. **assistant-ui-research-report.md** (Full analysis)
**Length:** 12 pages
**Purpose:** Comprehensive investigation with sources and deep analysis

**Start reading if:** You need to justify your decision to stakeholders or team
- Executive summary
- Each finding with context, implications, and sources
- Real-world GitHub issues revealing pain points
- Architecture overview and design philosophy
- Supabase Realtime integration walkthrough
- All 10 unresolved questions

---

### 4. **ASSISTANT_UI_FEASIBLE_ARCHITECTURES.md** (If you decide to use it)
**Length:** 8 pages
**Purpose:** How to architect if you must use assistant-ui

**Start reading if:** You're committed to using assistant-ui despite limitations
- **Architecture 1 (RECOMMENDED):** Hybrid UI - assistant-ui for AI only, custom group chat
- **Architecture 2:** Full assistant-ui with metadata workarounds
- **Architecture 3:** Minimal assistant-ui (component library only)
- Implementation code examples for each
- Pros/cons and complexity matrix

---

## 🎯 Quick Navigation by Question

| Your Question | Go To |
|---------------|-------|
| "Should we use it?" | ASSISTANT_UI_VERDICT.md |
| "Why or why not?" | ASSISTANT_UI_KEY_FINDINGS.md (use case table) |
| "Give me everything" | assistant-ui-research-report.md |
| "We're using it anyway, how?" | ASSISTANT_UI_FEASIBLE_ARCHITECTURES.md |
| "One-page summary?" | ASSISTANT_UI_KEY_FINDINGS.md |

---

## ⚡ Key Findings (Tl;DR)

### The Problem
assistant-ui is designed for **single-user AI conversation** (user ↔ AI).
Group chat requires **multi-user messaging** (human ↔ human ↔ AI).

### The Blocker
- Only 3 message roles: "user", "assistant", "system"
- Cannot distinguish Alice from Bob (both map to "user")
- All humans grouped under same role = breaks participant identity

### The Workaround
- Use ExternalStoreRuntime for custom message sources ✅ possible
- Store participant ID in message.metadata ✅ possible
- Render metadata with custom Message component ✅ possible
- **But:** You're building 70% custom UI, defeating the framework's purpose

### The Reality
- Zero official examples for multi-user chat
- ExternalStoreRuntime underdocumented (users read source code)
- Known stability issues in isRunning flag and thread creation
- Maintainer shows no urgency on multi-user requests

### The Verdict
**Time cost of using assistant-ui ≈ Time cost of building custom UI**
**But:** Using assistant-ui adds complexity, documentation gaps, and stability risk

**Recommendation:** Build group chat UI with Supabase Realtime + React. If you need AI responses later, evaluate assistant-ui then.

---

## 📊 Decision Matrix

```
Is group messaging           Are you comfortable     Can you tolerate
your PRIMARY feature?        with custom UI work?    stability issues?
      ↓                             ↓                       ↓
     YES                            -                       -
      ↓
   DON'T USE ASSISTANT-UI
   Use: Supabase + React

     NO (AI is primary)       Do you need AI features
                              like editing/regeneration?
                                    ↓
                                   YES
                                    ↓
                              Hybrid Approach
                              (Architecture 1)
```

---

## 🔗 Source Repositories & Links

**Documentation:**
- [assistant-ui.com/docs](https://www.assistant-ui.com/docs)
- [ExternalStoreRuntime](https://www.assistant-ui.com/docs/runtimes/custom/external-store)
- [Runtime Options](https://www.assistant-ui.com/docs/runtimes/pick-a-runtime)

**GitHub Repository:**
- [assistant-ui/assistant-ui](https://github.com/assistant-ui/assistant-ui)

**Key Issues:**
- [#2143: Custom roles](https://github.com/assistant-ui/assistant-ui/issues/2143)
- [#1838: ExternalStoreRuntime docs](https://github.com/assistant-ui/assistant-ui/issues/1838)
- [#2603: isRunning bug](https://github.com/assistant-ui/assistant-ui/issues/2603)
- [#2292: Thread creation broken](https://github.com/assistant-ui/assistant-ui/issues/2292)

**Related Documentation:**
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [AI SDK UI Message Metadata](https://ai-sdk.dev/docs/ai-sdk-ui/message-metadata)

---

## 📝 What Was Researched

✅ Can assistant-ui handle multiple human participants?
✅ Does it support custom message sources (Supabase, database)?
✅ Can you build a custom runtime?
✅ Are there examples of assistant-ui for multi-user chat?
✅ What is the ExternalStoreRuntime API?
✅ Can message roles go beyond "user"/"assistant"?
✅ Can you have multiple user identities?
✅ Does ThreadList support multiple conversations?
✅ Architecture patterns and design philosophy
✅ Real-world GitHub issues and pain points
✅ Message metadata and custom field support

---

## 💡 Key Insights

1. **Design Mismatch:** Framework assumes single user → AI response pattern. Group chat breaks this.

2. **Role Rigidity:** Three roles only, requested feature stalled. Not changing soon.

3. **Underdocumented:** ExternalStoreRuntime (your only option for custom sources) has documentation gaps.

4. **Workaround Cost:** Possible with metadata + custom components, but you lose framework benefits.

5. **Stability Risk:** Known bugs in ExternalStoreRuntime; minor versions break thread creation.

6. **No Community:** Zero examples of group messaging. Clear signal it's out of scope.

7. **Hybrid Option:** If you need assistant-ui for AI responses, keep group chat separate.

8. **Time Comparison:** Building custom group chat ≈ Building with assistant-ui + workarounds. No time saved.

---

## ✅ Action Items

**If you decide NOT to use it:**
- [ ] Read ASSISTANT_UI_VERDICT.md (2 min)
- [ ] Review ASSISTANT_UI_KEY_FINDINGS.md decision checklist (5 min)
- [ ] Share full report with team
- [ ] Prototype with Supabase Realtime

**If you decide to use it:**
- [ ] Read ASSISTANT_UI_FEASIBLE_ARCHITECTURES.md (15 min)
- [ ] Choose Architecture 1, 2, or 3
- [ ] Build proof-of-concept for ExternalStoreRuntime
- [ ] Test early for stability issues
- [ ] Monitor GitHub issues #2603, #2292

**For the team:**
- [ ] Share ASSISTANT_UI_VERDICT.md
- [ ] Discuss use case (group chat vs. AI-only)
- [ ] Decide: custom UI vs. hybrid approach
- [ ] Document decision in project decisions log

---

## 📞 Questions Not Answered

Five questions remain unresolved (see ASSISTANT_UI_RESEARCH_REPORT.md for details):

1. Does `convertMessage` callback support async?
2. How does thread isolation work with ExternalStoreRuntime + database?
3. Will arbitrary message roles ever be supported?
4. What's the stability roadmap for ExternalStoreRuntime?
5. Can metadata fields be indexed/queried at the component level?

**Recommendation:** Ask on GitHub Discussions or check source code if these matter to your use case.

---

## 📚 How to Read This Research

**Fast track (15 minutes):**
1. ASSISTANT_UI_VERDICT.md (2 min)
2. ASSISTANT_UI_KEY_FINDINGS.md (5 min)
3. Decision checklist (3 min)
4. Share with team

**Detailed review (1 hour):**
1. This index file (5 min)
2. ASSISTANT_UI_KEY_FINDINGS.md (10 min)
3. assistant-ui-research-report.md (30 min)
4. ASSISTANT_UI_FEASIBLE_ARCHITECTURES.md if needed (15 min)

**Implementation planning (2+ hours):**
1. Read appropriate architecture doc
2. Write implementation plan
3. Build POC for state management
4. Test with ExternalStoreRuntime early
5. Adjust architecture based on findings

---

## 🏁 Bottom Line

**Use assistant-ui for:** Single-user AI chat, AI responses in hybrid UI
**Don't use for:** Multi-user group messaging, human-to-human chat
**Alternative:** Supabase Realtime + custom React UI (faster, cleaner, less risk)

**If group messaging is core:** Build custom UI. You'll save time and sanity.

---

*Last updated: March 16, 2026*
