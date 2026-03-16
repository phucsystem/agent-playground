# Code Review: Typewriter Animation for Agent Messages

**Date:** 2026-03-17
**Reviewer:** code-reviewer
**Scope:** `src/hooks/use-typewriter.ts` (new), `src/components/chat/message-item.tsx` (modified)
**LOC changed:** ~70 lines added

---

## Overall Assessment

Solid implementation. The rAF-based animation hook is clean, the history-vs-new distinction via module-level Set + recency check is correct. Several edge cases and one performance concern warrant attention.

---

## Critical Issues

None.

---

## High Priority

### H1. Module-level Set leaks memory across navigation

`animatedMessageIds` is a module-scope `Set<string>`. It grows unboundedly as the user switches conversations. In a long session with active agents, this accumulates thousands of IDs with no cleanup.

**Impact:** Memory leak proportional to session length.

**Fix:** Use a bounded LRU-style approach or clear the set on conversation change. Simplest option -- cap the set size:

```ts
const MAX_TRACKED = 500;

function trackAnimated(id: string) {
  animatedMessageIds.add(id);
  if (animatedMessageIds.size > MAX_TRACKED) {
    const first = animatedMessageIds.values().next().value;
    animatedMessageIds.delete(first);
  }
}
```

Or clear on conversation switch (requires wiring `conversationId` prop through).

### H2. fullText change during animation resets to 0 -- visible flicker

The `useEffect` in `useTypewriter` depends on `[fullText, shouldAnimate]`. If the parent re-renders with a slightly different `fullText` (e.g., realtime message content update, whitespace normalization), the effect resets `visibleLength` to 0, causing visible flicker mid-animation.

**Impact:** UX glitch if message content mutates after initial render.

**Fix:** Either:
- Capture `fullText` at mount via ref and ignore subsequent changes while animating
- Or guard the reset: only reset if the text meaningfully changed (not just reference identity)

```ts
const initialTextRef = useRef(fullText);

useEffect(() => {
  if (!shouldAnimate) {
    setVisibleLength(fullText.length);
    return;
  }
  // Only reset if text actually changed substantially
  if (initialTextRef.current === fullText) return;
  // ...existing animation setup
}, [fullText, shouldAnimate]);
```

### H3. Virtualizer height mismatch during animation

`estimateMessageHeight` in `message-list.tsx` estimates based on `message.content.length`. But during typewriter animation, `AgentTextContent` renders partial text (shorter) then switches to `MarkdownContent` (which may render taller due to paragraphs, code blocks, lists). The virtualizer's `measureElement` ref will re-measure, but the jump from plain `<span>` to rendered markdown can cause scroll position jank.

**Impact:** Visual scroll jump when animation completes, especially for messages with markdown formatting.

**Fix:** Consider animating within `MarkdownContent` using CSS `clip-path` or `max-height` transition instead of switching between two different DOM structures. Alternatively, call `virtualizer.measure()` after animation completes.

---

## Medium Priority

### M1. `markedRef` is redundant -- useEffect already runs once per message.id

The `markedRef` guard in `AgentTextContent` is unnecessary. The `useEffect` with `[message.id]` dependency only fires once per message ID. The ref adds cognitive overhead without preventing double-execution (React strict mode double-fires effects but also cleans them up).

**Impact:** Minor complexity.

**Fix:** Remove `markedRef`, just use the effect directly:

```ts
useEffect(() => {
  animatedMessageIds.add(message.id);
}, [message.id]);
```

Note: In React 18 strict mode (dev only), effects fire twice. But since `Set.add` is idempotent, there's no issue.

### M2. No skip/click-to-reveal interaction exposed

The `useTypewriter` hook returns a `skip` function but `AgentTextContent` never exposes it to the user. Long agent messages (~2000+ chars) will take ~30 seconds to animate at 15ms/char.

**Impact:** Users forced to wait for long messages.

**Fix:** Add click-to-skip on the animating text:

```tsx
<span className="whitespace-pre-wrap cursor-pointer" onClick={skip}>
  {displayText}
  ...
</span>
```

### M3. Animation plays plain text, then snaps to markdown

During animation, text renders in a `<span>` with `whitespace-pre-wrap`. On completion, it switches to `<MarkdownContent>`. This means:
- Links appear as raw URLs during animation, then become clickable
- Bold/italic syntax shows as `**text**` then renders formatted
- Code blocks show as backtick-wrapped text then format

**Impact:** Jarring visual transition at animation end.

**Fix:** Either:
1. Render markdown incrementally (complex but smooth)
2. Add a brief CSS opacity transition between the two states
3. Document this as intentional "raw -> formatted" reveal effect

### M4. `isAnimating` double-gates on `shouldAnimate`

Line 19-20 in the hook:
```ts
const isAnimating = enabled && visibleLength < fullText.length && !skippedRef.current;
const shouldAnimate = enabled && fullText.length >= MIN_LENGTH_TO_ANIMATE;
```

Return line 66:
```ts
isAnimating: shouldAnimate && isAnimating,
```

This double-checks `enabled` (once in `isAnimating`, once in `shouldAnimate`). Not a bug but unnecessarily redundant.

---

## Low Priority

### L1. CHAR_INTERVAL_MS = 15 is fast for long messages

At 15ms/char, a 500-char message takes 7.5 seconds. A 2000-char message takes 30 seconds. Consider accelerating for longer texts (e.g., logarithmic slowdown or chunked reveal).

### L2. `animate-pulse` cursor flickers at 60fps rAF rate

The cursor span uses Tailwind's `animate-pulse` (CSS animation) while the text updates via rAF. These are independent timing systems. Minor visual concern only.

---

## Edge Cases Found by Scouting

1. **Virtualizer re-render:** `message-list.tsx` uses `@tanstack/react-virtual`. When `MessageItem` changes height mid-animation (plain text -> markdown), `measureElement` ref triggers re-measurement. Multiple simultaneous agent messages animating = multiple layout thrashes.

2. **React strict mode:** Double effect execution in dev will call `animatedMessageIds.add()` twice -- harmless since Set is idempotent, but the animation effect cleanup/restart could cause a visible flicker in dev mode.

3. **Conversation switch race:** If user switches conversations while animation is in progress, the rAF cleanup runs but `animatedMessageIds` already has the ID. On returning to the conversation, the message won't re-animate (correct behavior). However, `isRecentMessage` uses wall clock -- a 25-second-old message that was mid-animation won't re-animate on return even if user only saw 2 seconds of it.

4. **Empty content edge case:** If `message.content` is empty string, `MIN_LENGTH_TO_ANIMATE` (20) prevents animation. Correct. But `fullText.length >= MIN_LENGTH_TO_ANIMATE` with exactly 20 chars will animate a very short message.

5. **SSR/hydration:** Both files are `"use client"`. The module-level `Set` initializes on module load. During SSR, the Set exists server-side but is empty. No hydration mismatch since `isRecentMessage` will return false for server-rendered messages (they'd be >30s old by the time client hydrates in most cases). Edge case: if hydration happens within 30s of message creation AND the message ID isn't in the Set, animation could trigger on a history message.

---

## Positive Observations

- Clean separation: animation logic in hook, integration logic in component
- rAF-based timing is correct -- uses elapsed time delta, not frame count
- Module-level Set for deduplication is simple and effective pattern
- `skip` callback properly cancels rAF and sets final state
- 30-second recency threshold is reasonable for distinguishing new vs history
- Cleanup function in useEffect properly cancels pending rAF

---

## Recommended Actions

1. **[H1]** Add Set size cap or conversation-switch cleanup
2. **[H2]** Guard against `fullText` mutation during animation
3. **[H3]** Address virtualizer height jump on animation complete
4. **[M2]** Wire up `skip` function to user interaction
5. **[M3]** Consider opacity transition between raw text and markdown render
6. **[L1]** Consider adaptive speed for long messages

---

## Metrics

- Type Coverage: Full (TypeScript strict, all props typed)
- Test Coverage: No tests for either file (not requested)
- Linting Issues: Not checked (per rules)

---

## Unresolved Questions

1. Is there a plan for streaming agent messages? If so, `fullText` will change frame-by-frame, making H2 critical.
2. Should the typewriter effect apply to non-text content types from agents (e.g., agent sends a URL or file)?
3. Is the 30-second recency threshold configurable or should it be?
