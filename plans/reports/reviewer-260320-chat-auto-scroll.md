# Code Review: Chat Auto-Scroll & Browser Tab Unread Count

**Date:** 2026-03-20
**Branch:** fix/chat-auto-scroll
**Reviewer:** code-reviewer

---

## Scope

- Files: `src/components/chat/message-list.tsx`, `src/app/chat/layout.tsx`
- LOC changed: ~20 lines
- Focus: Auto-scroll reliability on new messages / conversation switch, browser tab unread badge

---

## Overall Assessment

Small, focused fix. Both changes address real UX issues (scroll not reaching bottom, no tab unread indicator). Logic is mostly sound with a few edge cases worth noting.

---

## File: `src/components/chat/message-list.tsx`

### Change 1 — Conversation switch reset (lines 112-114)

```ts
isAtBottomRef.current = true;
setShowScrollDown(false);
```

**Verdict: Good.** When switching conversations, resetting `isAtBottomRef` to `true` and hiding the scroll-down button prevents stale state from a previous conversation leaking into the new one. Without this, if user scrolled up in conversation A then switched to B, the auto-scroll for new messages in B would not fire.

### Change 2 — Double rAF on initial load (lines 128-132)

```ts
requestAnimationFrame(() => {
  scrollToBottom(false);
  isAtBottomRef.current = true;
  setVisible(true);
});
```

**Analysis:** The original code used `virtualizer.scrollToIndex` then a single rAF to reveal. Now it adds an extra `scrollToBottom(false)` call inside that rAF. This is a defensive "belt and suspenders" approach — the virtualizer's `scrollToIndex` may not land exactly at the bottom due to estimated sizes, so `scrollToBottom` does a raw `scrollTo({ top: scrollHeight })` to guarantee it.

**Verdict: Acceptable.** The double-scroll is harmless (instant, no visual flicker because `visible` is still false until `setVisible(true)` runs in the same frame). The `isAtBottomRef.current = true` line is redundant since it's already set in the conversation-switch effect, but setting it here too is defensive and fine.

### Change 3 — Double rAF for new message scroll (lines 139-143)

```ts
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    parentRef.current?.scrollTo({ top: parentRef.current.scrollHeight, behavior: "smooth" });
  });
});
```

**Analysis:** This nested `requestAnimationFrame` delays the scroll by one extra frame. The likely reason: when a new message arrives, the virtualizer needs one frame to measure/render the new item before `scrollHeight` reflects it. Without the second rAF, `scrollHeight` may still be stale.

**Concern — Medium:** Double rAF is a known pattern but fragile. It works on most browsers/devices but is technically timing-dependent. If the virtualizer takes more than one frame to measure (e.g., images loading, complex markdown), the scroll may still fall short. Consider using `virtualizer.scrollToIndex(messages.length - 1, { align: "end", behavior: "smooth" })` instead, which lets the virtualizer handle the offset calculation directly.

**Recommendation:**
```ts
// More reliable: let the virtualizer calculate the position
requestAnimationFrame(() => {
  virtualizer.scrollToIndex(messages.length - 1, {
    align: "end",
    behavior: "smooth",
  });
});
```

### Edge Case: 0 messages

Line 120 guards with `if (messages.length === 0) return;` — correct. The conversation-switch effect (line 108) runs before the messages effect, so `prevMessageCount` is reset to 0, and the next render with messages triggers the initial-load path. No issue here.

### Edge Case: Rapid conversation switching

If user switches conversations faster than data loads, the `conversationId` effect fires multiple times resetting state. This is safe because:
- `setVisible(false)` hides stale content
- `prevMessageCount.current = 0` ensures the next batch triggers initial-load path
- No cleanup needed since rAFs are fire-and-forget (they just do DOM scroll)

However: if `messages` from the *old* conversation arrive after the switch (stale data), the `prevMessageCount === 0` check will trigger scroll-to-bottom on wrong data, then the correct conversation's messages will reset again. This is unlikely with React Query's keyed queries but worth noting.

### Edge Case: `scrollToBottom` dependency

`scrollToBottom` uses `useCallback` with no deps (line 102). The `parentRef.current` is read at call time, not closure time. This is correct — no stale ref issue.

---

## File: `src/app/chat/layout.tsx`

### Change — Browser tab unread count (lines 58-62)

```ts
const APP_TITLE = "Agent Playground";
useEffect(() => {
  const totalUnread = Object.values(unreadByWorkspace).reduce((sum, count) => sum + count, 0);
  document.title = totalUnread > 0 ? `(${totalUnread}) ${APP_TITLE}` : APP_TITLE;
}, [unreadByWorkspace]);
```

**Verdict: Good overall.** Standard pattern for tab unread badges.

### Issue — Low: `APP_TITLE` declared inside component body

`APP_TITLE` is a constant string declared on every render at line 58. Should be hoisted outside the component or to module scope. Not a bug, just unnecessary allocation.

**Recommendation:** Move to module scope:
```ts
const APP_TITLE = "Agent Playground";

function ChatLayoutContent({ ... }) {
```

### Issue — Medium: Missing cleanup on unmount

When the `ChatLayoutContent` component unmounts (user logs out, navigates away from `/chat`), `document.title` remains as `(N) Agent Playground`. There is no cleanup effect to reset it.

**Recommendation:**
```ts
useEffect(() => {
  const totalUnread = Object.values(unreadByWorkspace).reduce((sum, count) => sum + count, 0);
  document.title = totalUnread > 0 ? `(${totalUnread}) ${APP_TITLE}` : APP_TITLE;
  return () => { document.title = APP_TITLE; };
}, [unreadByWorkspace]);
```

### Edge Case: `unreadByWorkspace` reference stability

`useWorkspaceUnread` returns `{ unreadByWorkspace }` from React Query's `data`. React Query returns a new reference only when data actually changes (structural sharing). The `useEffect` dependency on `unreadByWorkspace` will not fire on every render — only when the query result changes. This is correct and efficient.

### Edge Case: Large unread counts

`Object.values(unreadByWorkspace).reduce(...)` has no cap. If total exceeds 999, the tab title becomes very long. Minor cosmetic issue. Consider capping: `totalUnread > 99 ? "99+" : totalUnread`.

---

## Critical Issues

None.

## High Priority

None.

## Medium Priority

1. **Double rAF fragility** — The nested `requestAnimationFrame` for new-message scroll is timing-dependent. Consider `virtualizer.scrollToIndex` as a more robust alternative.
2. **Missing title cleanup** — `document.title` not reset on component unmount.

## Low Priority

1. **`APP_TITLE` placement** — Move constant to module scope.
2. **Unread count cap** — Consider `99+` cap for tab title readability.

## Positive Observations

- Conversation switch state reset is thorough (count, scroll position, visibility)
- `opacity-0` → `opacity-100` transition prevents flash of mis-scrolled content
- `isAtBottomRef` pattern correctly avoids scroll hijacking when user is reading history
- Unread count aggregation in `useWorkspaceUnread` correctly filters zero-count workspaces

## Recommended Actions

1. Add cleanup return to the `document.title` useEffect
2. Move `APP_TITLE` to module scope
3. Consider replacing double-rAF with `virtualizer.scrollToIndex` for new messages (optional, current approach works in practice)

---

## Metrics

- Type Coverage: Pass (no new TS errors from these changes)
- Linting: Not checked (per project rules, no auto-lint)
- Test Coverage: N/A (no tests modified)
