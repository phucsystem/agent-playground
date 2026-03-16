---
title: TanStack React Virtual for Chat Message Lists - Research Report
date: 2026-03-16
author: Researcher Agent
---

# TanStack React Virtual for Chat Message Lists

## Executive Summary

TanStack React Virtual (v3.13.22) is production-ready for chat UIs but requires custom implementation patterns for reverse scrolling (bottom-anchored messaging). No built-in reverse support exists; instead, use scroll position anchoring + dynamic height measurement. Infinite scroll combines with prepending items by tracking scroll offset during data loads.

---

## 1. Installation & Versioning

### Latest Version: 3.13.22 (as of March 2026)

```bash
npm install @tanstack/react-virtual
# or
yarn add @tanstack/react-virtual
# or
pnpm add @tanstack/react-virtual
```

**Compatibility Requirements:**
- React 16.8+ (hooks required)
- Node 14.0+ minimum
- Framework adapters: `@storybook-vue/nuxt` for Nuxt integration (if relevant)

**Key Imports:**
```typescript
import { useVirtualizer } from '@tanstack/react-virtual'
```

---

## 2. Reverse Scrolling for Chat (Newest Messages at Bottom)

### Challenge
TanStack Virtual measures everything in positive pixels. Reverse scrolling (like chat UIs) requires custom patterns—no native `reverse: true` flag exists.

**Status:** PR #400 proposed reverse support (2023) but closed as outdated. Maintainers recommend scroll-anchoring patterns instead.

### Recommended Pattern: Scroll Anchoring + CSS Flex Column Reverse

**Container Setup:**
```tsx
// In your chat container, use flex-direction: column-reverse
<div
  style={{
    display: 'flex',
    flexDirection: 'column-reverse',
    height: '100%',
    overflow: 'hidden'
  }}
  ref={parentRef}
>
  {/* virtualizer renders here */}
</div>
```

**Why This Works:**
- Messages naturally flow newest-at-bottom
- No accessibility issues (unlike CSS `scaleY(-1)`)
- Text selection works normally
- Scroll behavior is intuitive

**Virtualizer Setup:**
```tsx
const virtualizer = useVirtualizer({
  count: messages.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 60, // estimate, refined by measureElement
  measureElement: typeof window !== 'undefined' ?
    element => element?.getBoundingClientRect().height
    : undefined,
  overscan: 5, // render extra items for smooth scrolling
})
```

### Handling "Stick to Bottom" on New Messages

**Pattern 1: Monitor Scroll Position (Recommended for Chat)**

```tsx
const [shouldStickToBottom, setShouldStickToBottom] = useState(true)

// Detect if user scrolled up
const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
  if (!virtualizer) return

  const container = e.currentTarget
  const atBottom =
    container.scrollHeight - container.scrollTop - container.clientHeight < 100

  setShouldStickToBottom(atBottom)
}, [virtualizer])

// Auto-scroll when new messages arrive
useEffect(() => {
  if (shouldStickToBottom && messages.length > 0) {
    const lastMessage = messages[messages.length - 1]
    virtualizer.scrollToIndex(messages.length - 1, {
      align: 'end',
      behavior: 'smooth'
    })
  }
}, [messages.length, shouldStickToBottom])
```

**Pattern 2: Use `useWindowVirtualizer` + `followOutput` (Simpler)**

For fixed-height scrollers, TanStack Virtual's `onChange` callback with scroll offset tracking:

```tsx
const virtualizer = useVirtualizer({
  count: messages.length,
  // ... other config
  onChange: (instance) => {
    // Triggered on scroll change
    // Can trigger auto-scroll logic here
  }
})

// Scroll to bottom imperatively
const scrollToBottom = () => {
  virtualizer.scrollToIndex(messages.length - 1, {
    align: 'end',
    behavior: 'smooth'
  })
}
```

### Alternative: React Virtuoso (Simpler for Chat)

If reverse scrolling becomes complex, consider [React Virtuoso](https://virtuoso.dev/) instead:
- Native `MessageList` component for chat
- Built-in `followOutput: true` / `followOutput: 'smooth'`
- Dynamic height support out-of-the-box
- No scroll anchoring patterns needed

---

## 3. Dynamic/Variable Height Items (Chat Messages)

### Core Challenge
Messages vary in height: text-only, images, code blocks, etc. Pre-calculated heights impossible.

### Solution: Dynamic Measurement + Estimation

**Implementation Pattern:**

```tsx
const virtualizer = useVirtualizer({
  count: messages.length,
  getScrollElement: () => parentRef.current,

  // 1. Estimate: use realistic max height (important for layout)
  estimateSize: (index) => {
    // Estimate based on content type
    const msg = messages[index]
    if (msg.type === 'image') return 350
    if (msg.type === 'code') return 200
    return 60 // typical text message
  },

  // 2. Measure: get actual height as rendered
  measureElement: typeof window !== 'undefined'
    ? element => element?.getBoundingClientRect().height
    : undefined,

  overscan: 10, // render extra items to avoid blank gaps during fast scroll
})
```

**How It Works:**
1. Virtualizer uses `estimateSize()` for initial layout
2. As items render, `measureElement()` gets actual DOM height via `getBoundingClientRect().height`
3. Virtualizer recalculates scroll positions as real measurements arrive
4. Scroll remains smooth because overscan prevents blank areas

**Key Configuration:**
- `overscan: 10` – render 10 items beyond visible area to prevent gaps during rapid scrolling
- `estimateSize()` – return max expected height per message type (prevents jumping)
- `measureElement` – called per-item, measures actual rendered height

### For Images with Unknown Dimensions

```tsx
estimateSize: (index) => {
  const msg = messages[index]
  if (msg.type === 'image') {
    // If you have image metadata (from image load), use actual height
    if (msg.imageHeight) return msg.imageHeight + 20 // padding
    // Otherwise, estimate max reasonable height
    return 350
  }
  return 60
}
```

---

## 4. Scroll to Bottom + Sticky Behavior

### Scroll to Bottom (Imperative)

```tsx
const scrollToBottom = () => {
  virtualizer.scrollToIndex(messages.length - 1, {
    align: 'end',        // align to bottom of viewport
    behavior: 'smooth'   // smooth animation
  })
}

// Call on new message (if not already at bottom)
useEffect(() => {
  if (shouldStickToBottom) {
    scrollToBottom()
  }
}, [messages.length])
```

### Sticky to Bottom (Automatic)

```tsx
const [shouldStickToBottom, setShouldStickToBottom] = useState(true)

const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
  const el = e.currentTarget
  const threshold = 100 // px from bottom
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
  setShouldStickToBottom(atBottom)
}

// Auto-scroll only when user is viewing bottom
useEffect(() => {
  if (shouldStickToBottom && messages.length > 0) {
    scrollToBottom()
  }
}, [messages.length, shouldStickToBottom])

return (
  <div
    ref={parentRef}
    style={{ height: '500px', overflow: 'auto', flexDirection: 'column-reverse' }}
    onScroll={handleScroll}
  >
    {/* virtualizer content */}
  </div>
)
```

**Behavior:**
- User scrolls up to view history → sticky disables, no auto-scroll
- New message arrives → virtualizer updates but doesn't jump (user browsing history)
- User scrolls back to bottom → sticky re-enables
- New message arrives → auto-scrolls smoothly to show it

---

## 5. Infinite Scroll (Load More When Scrolling to Top)

### Pattern: Prepend Messages with Scroll Offset Anchoring

**Problem:** When prepending items (loading older messages), scroll jumps to unexpected position.

**Solution:** Track scroll offset, restore it after prepending.

```tsx
const [messages, setMessages] = useState<Message[]>([])
const [hasMoreOlder, setHasMoreOlder] = useState(true)
const parentRef = useRef<HTMLDivElement>(null)
const prevSizeRef = useRef(0)

const virtualizer = useVirtualizer({
  count: messages.length,
  getScrollElement: () => parentRef.current,
  estimateSize: (index) => estimateMessageHeight(messages[index]),
  measureElement: typeof window !== 'undefined'
    ? element => element?.getBoundingClientRect().height
    : undefined,
  overscan: 10,
})

// Check if scrolled to top, trigger load more
const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
  const el = e.currentTarget
  const threshold = 200 // px from top

  if (el.scrollTop < threshold && hasMoreOlder && !isLoadingOlder) {
    loadOlderMessages()
  }
}

const loadOlderMessages = async () => {
  setIsLoadingOlder(true)

  // 1. Record current scroll state before adding items
  const oldSize = virtualizer.getTotalSize()
  const oldScrollTop = parentRef.current?.scrollTop || 0

  // 2. Fetch and prepend older messages
  const older = await fetchOlderMessages()
  setMessages(prev => [...older, ...prev])

  // 3. Wait for re-render, then restore scroll position
  // The scroll offset increases by the size of new items
  requestAnimationFrame(() => {
    const newSize = virtualizer.getTotalSize()
    const sizeDiff = newSize - oldSize

    if (parentRef.current) {
      parentRef.current.scrollTop = oldScrollTop + sizeDiff
    }
  })

  setIsLoadingOlder(false)
}

return (
  <div
    ref={parentRef}
    style={{
      height: '500px',
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column-reverse'
    }}
    onScroll={handleScroll}
  >
    <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
      {virtualizer.getVirtualItems().map(virtualItem => (
        <div
          key={messages[virtualItem.index].id}
          data-index={virtualItem.index}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: virtualItem.size,
            transform: `translateY(${virtualItem.start}px)`
          }}
        >
          <Message message={messages[virtualItem.index]} />
        </div>
      ))}
    </div>
  </div>
)
```

### Simpler Pattern: Use Intersection Observer (Less Accuracy)

```tsx
// Create sentinel div at top of list
<div ref={loadMoreSentinelRef} />

// Observe when it becomes visible
useEffect(() => {
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && hasMoreOlder) {
      loadOlderMessages()
    }
  })

  if (loadMoreSentinelRef.current) {
    observer.observe(loadMoreSentinelRef.current)
  }

  return () => observer.disconnect()
}, [hasMoreOlder])
```

### With Infinite Query (TanStack Query)

```tsx
import { useInfiniteQuery } from '@tanstack/react-query'

const { data, fetchPreviousPage, hasPreviousPage, isFetchingPreviousPage } =
  useInfiniteQuery({
    queryKey: ['messages'],
    queryFn: ({ pageParam = 0 }) =>
      fetchMessages({ offset: pageParam, limit: 30 }),
    initialPageParam: 0,
    getPreviousPageParam: (firstPage, allPages) =>
      allPages.length > 0 ? (allPages.length) * 30 : undefined,
  })

const allMessages = data?.pages.flatMap(page => page.messages) || []

// Call fetchPreviousPage when scrolling to top
const loadOlderMessages = () => {
  if (hasPreviousPage && !isFetchingPreviousPage) {
    fetchPreviousPage()
  }
}
```

---

## 6. Complete Chat Component Example

```tsx
import React, { useRef, useState, useEffect, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

interface Message {
  id: string
  content: string
  type: 'text' | 'image' | 'code'
  height?: number // cached actual height
}

export const ChatMessageList: React.FC<{
  messages: Message[]
  onLoadOlder?: () => void
  hasMoreOlder?: boolean
}> = ({ messages, onLoadOlder, hasMoreOlder = false }) => {
  const parentRef = useRef<HTMLDivElement>(null)
  const [shouldStickToBottom, setShouldStickToBottom] = useState(true)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)

  // Estimate height based on message type
  const estimateSize = useCallback((index: number) => {
    const msg = messages[index]
    if (msg.height) return msg.height // use cached measurement
    switch (msg.type) {
      case 'image': return 350
      case 'code': return 200
      default: return 60
    }
  }, [messages])

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    measureElement: typeof window !== 'undefined'
      ? element => element?.getBoundingClientRect().height
      : undefined,
    overscan: 10,
  })

  // Stick to bottom when new messages arrive
  useEffect(() => {
    if (shouldStickToBottom && messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, {
        align: 'end',
        behavior: 'smooth'
      })
    }
  }, [messages.length, shouldStickToBottom, virtualizer])

  // Detect if user is at bottom
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const threshold = 100
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    setShouldStickToBottom(atBottom)

    // Load older messages if scrolled to top
    if (el.scrollTop < 200 && hasMoreOlder && !isLoadingOlder && onLoadOlder) {
      setIsLoadingOlder(true)
      onLoadOlder()
      setIsLoadingOlder(false)
    }
  }, [hasMoreOlder, isLoadingOlder, onLoadOlder])

  return (
    <div
      ref={parentRef}
      style={{
        height: '100%',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column-reverse'
      }}
      onScroll={handleScroll}
    >
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={messages[virtualItem.index].id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: virtualItem.size,
              transform: `translateY(${virtualItem.start}px)`
            }}
          >
            <ChatMessage message={messages[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}

const ChatMessage: React.FC<{ message: Message }> = ({ message }) => {
  return (
    <div style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
      {message.type === 'text' && <p>{message.content}</p>}
      {message.type === 'image' && <img src={message.content} alt="" />}
      {message.type === 'code' && <pre><code>{message.content}</code></pre>}
    </div>
  )
}
```

---

## 7. Key Configuration Options Reference

| Option | Type | Default | Purpose |
|--------|------|---------|---------|
| `count` | number | - | Total items (required) |
| `getScrollElement` | () => Element \| null | - | Scroll container (required) |
| `estimateSize` | (index: number) => number | - | Estimated item size (required) |
| `measureElement` | (el: Element) => number | - | Actual item size callback |
| `overscan` | number | 1 | Items to render outside viewport |
| `horizontal` | boolean | false | Switch to horizontal scrolling |
| `paddingStart` | number | 0 | Top/left padding |
| `paddingEnd` | number | 0 | Bottom/right padding |
| `onChange` | (instance) => void | - | Scroll change callback |
| `enabled` | boolean | true | Enable/disable virtualization |
| `initialOffset` | number | 0 | Starting scroll position |

---

## 8. Performance Optimization Tips

### 1. Memoize Messages
```tsx
const memoizedMessages = useMemo(() => messages, [messages])
```

### 2. Increase Overscan for Slower Devices
```tsx
overscan: parseInt(navigator.hardwareConcurrency) < 4 ? 20 : 10
```

### 3. Debounce Scroll Events
```tsx
const handleScroll = useCallback(
  debounce((e) => { /* ... */ }, 100),
  []
)
```

### 4. Use React.memo for Chat Items
```tsx
const ChatMessage = React.memo(({ message }: { message: Message }) => (
  <div>{message.content}</div>
), (prev, next) => prev.message.id === next.message.id)
```

---

## 9. Common Pitfalls & Solutions

| Problem | Cause | Solution |
|---------|-------|----------|
| **Blank gaps during scroll** | Low `overscan` | Increase to 10-20 |
| **Layout shift on new messages** | Wrong `estimateSize` | Estimate max height per type |
| **Scroll jumps when prepending** | No scroll offset anchoring | Track + restore scroll offset |
| **Images not measuring correctly** | Image load delay | Provide height via `onLoad` callback |
| **Auto-scroll doesn't work** | `shouldStickToBottom` always false | Check scroll threshold (100px) |
| **Reverse scrolling jumpy** | CSS `scaleY(-1)` accessibility | Use `flex-direction: column-reverse` instead |

---

## 10. Recommended Architecture for Chat App

```
ChatContainer
├── MessageList (virtualized, flex-column-reverse)
│   ├── Virtual items with dynamic heights
│   ├── Infinite scroll (prepend) on top
│   └── Auto-scroll to bottom on new messages
├── MessageInput
└── Scroll-to-Bottom Button (show when shouldStickToBottom = false)
```

**Data Flow:**
1. User sends message → append to array
2. Auto-scroll fires (if at bottom)
3. New message renders with dynamic height measurement
4. User scrolls up → sticky disables
5. Older messages load (prepend) → scroll anchored
6. User scrolls down → sticky re-enables

---

## Sources

- [TanStack Virtual Official Docs](https://tanstack.com/virtual/latest/docs/framework/react/react-virtual)
- [Infinite Scroll Example - TanStack Virtual](https://tanstack.com/virtual/latest/docs/framework/react/examples/infinite-scroll)
- [Dynamic Height Example - TanStack Virtual](https://tanstack.com/virtual/latest/docs/framework/react/examples/dynamic)
- [GitHub Discussion: Reversed Virtual Lists](https://github.com/TanStack/virtual/discussions/195)
- [PR #400: Add Reverse Support](https://github.com/TanStack/virtual/pull/400)
- [Reverse Infinite Scroll Pattern - Medium](https://medium.com/@rmoghariya7/reverse-infinite-scroll-in-react-using-tanstack-virtual-11a1fea24042)
- [Virtualizer API Documentation](https://tanstack.com/virtual/latest/docs/api/virtualizer)
- [LogRocket: Speed Up Long Lists with TanStack Virtual](https://blog.logrocket.com/speed-up-long-lists-tanstack-virtual/)
- [Stack Blitz: Reverse Chat Messages List](https://stackblitz.com/edit/react-fnqbh9)
- [Stick to Bottom Hook (StackBlitz Labs)](https://github.com/stackblitz-labs/use-stick-to-bottom)

---

## Unresolved Questions

1. **Exact timing for scroll offset restoration:** Should use `requestAnimationFrame` or wait for virtualizer state change? Current research suggests `requestAnimationFrame` but performance testing needed.

2. **Image height caching:** Should cache image heights in message state? Prevents re-measurement but adds complexity.

3. **React 19 compatibility:** `useFlushSync` defaults to true but causes warnings in React 19. Should disable by default or provide migration guide?

4. **Accessibility:** CSS `flex-direction: column-reverse` + virtualization interaction with screen readers—needs testing on production chat.
