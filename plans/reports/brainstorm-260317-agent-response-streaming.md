# Brainstorm: Agent Response Streaming (Typewriter)

**Date:** 2026-03-17
**Status:** Agreed
**Topic:** Token-by-token streaming UX for agent responses

---

## Problem Statement

Agent responses appear as a full block of text instantly. No visual feedback between "Agent is thinking..." and the complete message. Users accustomed to ChatGPT-style streaming perceive this as slow/unpolished.

## Evaluated Approaches

### 1. Real Token-by-Token Streaming (SSE) — REJECTED
Agent returns Server-Sent Events, server proxies to client.
- **Pros:** True streaming, real perceived speed improvement
- **Cons:** Requires agent contract change (breaking), complex server infra, all agents must implement SSE
- **Verdict:** Overkill — agents use simple webhook POST/response

### 2. Supabase Broadcast Chunks — REJECTED
Edge Function streams agent response chunks via Supabase Realtime broadcast.
- **Pros:** Real chunks, leverages existing infra
- **Cons:** Still requires agent-side streaming, adds Edge Function complexity
- **Verdict:** Same agent-side constraint as #1

### 3. Typewriter Animation (Client-Side) — SELECTED
Full message arrives via existing CDC. UI reveals it character-by-character with ~15ms/char animation.
- **Pros:** Zero agent changes, zero server changes, ~60 LOC, 95% of perceived UX benefit
- **Cons:** Adds ~1-2s artificial delay on short messages, not "real" streaming
- **Verdict:** Maximum ROI — pure frontend change, preserves existing architecture

## Agreed Solution

### Architecture

```
Agent reply INSERT → CDC broadcast → useRealtimeMessages receives full message
    ↓
MessageItem detects: is_agent + is new message (not from history)
    ↓
useTypewriter hook:
  - visibleLength starts at 0
  - requestAnimationFrame increments by 1 char per ~15ms
  - Renders content.slice(0, visibleLength) as plain text
  - On complete: switch to full MarkdownContent rendering
    ↓
Thinking indicator: smooth handoff (fade out as first char appears)
```

### Components

| Layer | Component | Details |
|-------|-----------|---------|
| Hook | `useTypewriter(text, options)` | Returns `{ displayText, isAnimating, skip }`. ~15ms/char via rAF. |
| MessageItem | Typewriter wrapper | Only for agent messages that just arrived (not history) |
| Thinking | Smooth handoff | Fade out thinking indicator as typewriter starts |

### Animation Rules

| Rule | Detail |
|------|--------|
| Speed | ~15ms per character (fast reveal) |
| Only new messages | Skip for history, page reload, conversation switch |
| Short message bypass | Messages <20 chars render instantly (no animation) |
| Markdown timing | Plain text during animation → full markdown on complete |
| Code blocks | Plain text during reveal, syntax-highlighted on complete |
| Re-render safety | Track animated message IDs in Set, never re-animate |
| Multiple messages | Queue sequentially |
| Scroll during animation | Complete instantly if user scrolls away |

### Thinking Indicator Handoff

```
"Agent is thinking..." [bouncing dots]
         ↓ (agent message arrives)
[dots fade out over 200ms]
         ↓
Typewriter starts: "W" → "Wh" → "Why" → "Why don't..." → full text
         ↓
Switch to full MarkdownContent with syntax highlighting
```

### Files Changed

| File | Change |
|------|--------|
| `src/hooks/use-typewriter.ts` | NEW — reusable typewriter animation hook (~30 LOC) |
| `src/components/chat/message-item.tsx` | MODIFY — wrap agent messages with typewriter |

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| No server changes | Webhook contract unchanged, no agent-side work |
| requestAnimationFrame over setInterval | Smoother, pauses when tab hidden, battery-friendly |
| Plain text during animation | Markdown mid-word looks broken (e.g. `**bol` renders as literal asterisks) |
| Skip short messages | Animating "OK" or "Sure!" feels silly |
| Track animated IDs | Virtual list re-renders shouldn't re-trigger animation |

### Risk Assessment

| Risk | Mitigation |
|------|------------|
| Perceived as "fake" | 15ms/char is fast enough to feel natural, not theatrical |
| Markdown flash on complete | Smooth transition — content already visible, just add formatting |
| Performance on long messages | rAF is throttled to 60fps; even 5000-char messages only take ~75s frames |
| Accessibility | Add `aria-live="polite"` so screen readers get the full text immediately |

## Success Criteria

- [ ] Agent messages animate character-by-character on arrival
- [ ] History/old messages render instantly (no animation)
- [ ] Smooth transition from thinking indicator to typewriter
- [ ] Markdown renders correctly after animation completes
- [ ] No re-animation on scroll, re-render, or conversation switch
- [ ] Short messages (<20 chars) skip animation

## Scope

**Total effort:** S (Small) — ~60 LOC, 2 files, frontend-only
**Dependencies:** None
**Breaking changes:** None
