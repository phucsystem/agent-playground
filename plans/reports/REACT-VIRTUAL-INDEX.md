---
title: TanStack React Virtual Research - Full Index
date: 2026-03-16
author: Researcher Agent
---

# TanStack React Virtual: Complete Research Package

## Research Summary

This package contains comprehensive research on implementing virtual scrolling for chat message lists using TanStack React Virtual (v3.13.22).

**Key Finding:** TanStack Virtual is excellent for performance but requires custom patterns for chat UIs—particularly reverse scrolling (bottom-anchored) and dynamic height handling.

---

## Documents in This Package

### 1. Main Research Report
**File:** `researcher-react-virtual-chat-implementation.md`

Complete deep-dive covering:
- Latest version (3.13.22) and installation
- Reverse scrolling patterns (CSS flex-direction: column-reverse)
- Dynamic height measurement (estimateSize + measureElement)
- Scroll-to-bottom and sticky behavior
- Infinite scroll with scroll position anchoring
- Complete working component example
- Configuration reference table
- Performance tips
- Common pitfalls and solutions

**Use when:** You need to understand the full picture before implementing

---

### 2. Quick Reference
**File:** `react-virtual-quick-reference.md`

Practical copy-paste code:
- Minimal chat component (complete)
- Cheat sheet for common patterns
- Key APIs table
- Performance checklist
- Anti-patterns to avoid
- When to use alternatives

**Use when:** You're ready to code and want starting templates

---

### 3. Advanced Patterns
**File:** `react-virtual-advanced-patterns.md`

Solutions to 7 common problems:
1. Prepending messages causes scroll jump (+ scroll anchoring)
2. Dynamic heights cause layout shift (+ progressive measurement)
3. Images load after position calculated (+ measure-on-load)
4. Auto-scroll too aggressive (+ sticky-to-bottom logic)
5. Performance degrades at 10K+ messages (+ lazy measurement)
6. Reverse scrolling accessibility (+ ARIA)
7. Memory leaks with large lists (+ bounded cache)

Plus:
- Recommended configs for different scenarios
- Testing patterns
- Migration path to React Virtuoso

**Use when:** You hit a specific problem or need production hardening

---

## Quick Navigation

### I want to...

**Get started quickly**
→ Read `react-virtual-quick-reference.md`

**Understand how it all works**
→ Read `researcher-react-virtual-chat-implementation.md` (sections 2-5)

**Implement reverse scrolling (newest at bottom)**
→ Read `researcher-react-virtual-chat-implementation.md` (section 2)

**Handle variable message heights (text, images, code)**
→ Read `researcher-react-virtual-chat-implementation.md` (section 3)

**Implement "stick to bottom" auto-scroll**
→ Read `researcher-react-virtual-chat-implementation.md` (section 4)

**Add infinite scroll (load older messages)**
→ Read `researcher-react-virtual-chat-implementation.md` (section 5)

**See a complete working example**
→ Copy from `researcher-react-virtual-chat-implementation.md` (section 6)

**Fix prepending causing scroll jump**
→ Read `react-virtual-advanced-patterns.md` (Problem 1)

**Fix dynamic heights causing layout shift**
→ Read `react-virtual-advanced-patterns.md` (Problem 2)

**Optimize for 10K+ messages**
→ Read `react-virtual-advanced-patterns.md` (Problem 5)

---

## Key Findings Summary

### Reverse Scrolling (Bottom-Anchored Chat)

**TanStack Virtual does NOT have native reverse support.** Use this pattern instead:

```tsx
<div
  style={{
    display: 'flex',
    flexDirection: 'column-reverse',
    overflow: 'auto'
  }}
  ref={parentRef}
>
  {/* virtualizer content */}
</div>
```

This is better than CSS `scaleY(-1)` (accessibility issues) and simpler than custom offset calculations.

---

### Dynamic Heights

Use `estimateSize()` + `measureElement()` combo:

```tsx
estimateSize: (index) => {
  const msg = messages[index]
  if (msg.type === 'image') return 350
  if (msg.type === 'code') return 200
  return 60
}

measureElement: element => element?.getBoundingClientRect().height
```

**Key:** Estimate conservatively (larger is better). Measurement happens automatically as items render.

---

### Auto-Scroll to Bottom

Two approaches:

**Simple (always scroll to bottom on new message):**
```tsx
useEffect(() => {
  virtualizer.scrollToIndex(messages.length - 1, { align: 'end' })
}, [messages.length])
```

**Smart (only scroll if user at bottom):**
```tsx
const [wasAtBottom, setWasAtBottom] = useState(true)

// Track scroll position
const handleScroll = (e) => {
  const atBottom = e.currentTarget.scrollHeight - e.currentTarget.scrollTop < 100
  setWasAtBottom(atBottom)
}

// Only auto-scroll if was at bottom
useEffect(() => {
  if (wasAtBottom) {
    virtualizer.scrollToIndex(messages.length - 1)
  }
}, [messages.length, wasAtBottom])
```

---

### Infinite Scroll (Load Older Messages)

When prepending items, scroll jumps. Solution: **scroll offset anchoring**

```tsx
const oldSize = virtualizer.getTotalSize()
const oldScroll = parentRef.current?.scrollTop || 0

setMessages(prev => [...olderMessages, ...prev])

requestAnimationFrame(() => {
  const newSize = virtualizer.getTotalSize()
  parentRef.current.scrollTop = oldScroll + (newSize - oldSize)
})
```

---

### Performance Optimization

| Scenario | Setting | Value |
|----------|---------|-------|
| Light chat | overscan | 5 |
| Normal chat | overscan | 10 |
| Heavy chat | overscan | 20 |
| All | estimateSize | realistic max height |
| Variable heights | measureElement | getBoundingClientRect |
| Slow devices | useFlushSync | false |

---

## Installation

```bash
npm install @tanstack/react-virtual
```

No additional dependencies required.

---

## Imports

```tsx
import { useVirtualizer } from '@tanstack/react-virtual'
// For window-level scrolling:
// import { useWindowVirtualizer } from '@tanstack/react-virtual'
```

---

## What NOT to Use

### ❌ React Virtuoso for non-chat UIs
Virtuoso is optimized for messaging. For other use cases (tables, feeds), TanStack Virtual is better.

### ❌ Native `reverse` prop
Doesn't exist. Use `flex-direction: column-reverse` instead.

### ❌ `scaleY(-1)` for reversal
Causes accessibility and text selection issues.

### ❌ Always auto-scrolling
Breaks reading history. Use sticky-to-bottom pattern instead.

### ❌ Very low `estimateSize`
Causes layout shifts. Always estimate the MAX expected height.

---

## Testing the Implementation

### Manual Testing Checklist

- [ ] New messages auto-scroll (if at bottom)
- [ ] Scroll up while new messages arrive → doesn't jump
- [ ] Older messages load when scrolling to top
- [ ] Scroll position stays stable during prepend
- [ ] Images load without causing layout shift
- [ ] Long messages (code blocks) display fully
- [ ] Smooth scrolling (no jank) at 60 FPS
- [ ] Performance acceptable with 1000+ messages
- [ ] Screen reader announces new messages (ARIA)

---

## Alternative Libraries

| Library | Pros | Cons |
|---------|------|------|
| **TanStack Virtual** | Headless, flexible | Requires custom patterns |
| **React Virtuoso** | Chat-optimized, sticky | Less flexible, heavier |
| **react-window** | Lightweight | No dynamic heights |
| **Virtua** | Good performance | Newer, less adoption |

---

## Common Mistakes

| Mistake | Impact | Fix |
|---------|--------|-----|
| estimateSize too small | Layout jumps | Estimate max height |
| overscan too low (< 5) | Blank gaps appear | Increase to 10+ |
| No measureElement | Heights inaccurate | Add callback for dynamic items |
| Always auto-scroll | Breaks history reading | Use wasAtBottom state |
| Prepend without scroll anchor | Scroll jumps | Track + restore scroll offset |
| No ARIA on reversed list | Accessibility broken | Add role="log", aria-live |

---

## API Cheat Sheet

### useVirtualizer Options

```tsx
const virtualizer = useVirtualizer({
  count: 100,                                    // Required: total items
  getScrollElement: () => containerRef.current,  // Required: scroll container
  estimateSize: (index) => 60,                   // Required: estimated height

  measureElement: el => el?.getBoundingClientRect().height,  // Optional
  overscan: 10,                                  // Optional: render beyond viewport
  horizontal: false,                             // Optional: horizontal scroll
  paddingStart: 0,                               // Optional: top padding
  paddingEnd: 0,                                 // Optional: bottom padding
  onChange: (instance) => {},                    // Optional: scroll change callback
  enabled: true,                                 // Optional: enable/disable
  initialOffset: 0,                              // Optional: start position
})
```

### useVirtualizer Methods

```tsx
virtualizer.scrollToIndex(index, { align: 'end', behavior: 'smooth' })
virtualizer.getTotalSize()                       // Total virtual height
virtualizer.getVirtualItems()                    // Array of visible items
virtualizer.measure()                            // Force remeasure all
virtualizer.scrollToOffset(px)                   // Scroll to pixel position
```

---

## Performance Expectations

| Scenario | Expected Performance |
|----------|---------------------|
| 100 messages | Instant, no virtualization needed |
| 500 messages | Smooth with virtualization |
| 1000 messages | Smooth, use overscan: 10 |
| 5000 messages | Smooth, use overscan: 20, lazy measurement |
| 10K+ messages | Consider bounded cache (max 1000 loaded) |

---

## Next Steps

1. **Review** `react-virtual-quick-reference.md` for copy-paste starting code
2. **Implement** the minimal example from section 2
3. **Customize** estimateSize for your message types
4. **Add** infinite scroll using section 5 pattern
5. **Test** with actual content
6. **Reference** `react-virtual-advanced-patterns.md` if you hit issues

---

## External Resources

- [Official TanStack Virtual Docs](https://tanstack.com/virtual/latest/)
- [Infinite Scroll Example](https://tanstack.com/virtual/latest/docs/framework/react/examples/infinite-scroll)
- [Dynamic Height Example](https://tanstack.com/virtual/latest/docs/framework/react/examples/dynamic)
- [GitHub Discussions](https://github.com/TanStack/virtual/discussions)
- [React Virtuoso Alternative](https://virtuoso.dev/)

---

## Questions?

See unresolved questions in the main research report for topics needing further investigation:
- Exact timing for scroll offset restoration
- Image height caching strategy
- React 19 compatibility for useFlushSync
- Accessibility with reversed DOM and screen readers

