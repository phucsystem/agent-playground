---
title: React Virtual Quick Reference - Chat Implementation
date: 2026-03-16
type: quick-reference
---

# React Virtual: Quick Reference for Chat Apps

## Installation
```bash
npm install @tanstack/react-virtual
```

## Minimal Chat Component (Copy-Paste Ready)

```tsx
import { useRef, useState, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

interface Message {
  id: string
  text: string
}

export function ChatList({ messages }: { messages: Message[] }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // average message height
    measureElement: typeof window !== 'undefined'
      ? el => el?.getBoundingClientRect().height
      : undefined,
    overscan: 10,
  })

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (atBottom && messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, {
        align: 'end',
        behavior: 'smooth'
      })
    }
  }, [messages.length, atBottom, virtualizer])

  // Detect if scrolled to bottom
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const threshold = 100 // px from bottom
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < threshold)
  }

  return (
    <div
      ref={parentRef}
      style={{
        height: '400px',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column-reverse' // newest at bottom
      }}
      onScroll={handleScroll}
    >
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map(vItem => (
          <div
            key={messages[vItem.index].id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: vItem.size,
              transform: `translateY(${vItem.start}px)`
            }}
          >
            <div style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
              {messages[vItem.index].text}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Cheat Sheet: Common Patterns

### 1. Dynamic Height (Text + Images + Code)
```tsx
estimateSize: (index) => {
  const msg = messages[index]
  if (msg.type === 'image') return 350
  if (msg.type === 'code') return 200
  return 60
}
```

### 2. Infinite Scroll (Load More on Top)
```tsx
const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
  if (e.currentTarget.scrollTop < 200 && hasMore && !loading) {
    // Load older messages
  }
}
```

### 3. Scroll to Bottom Button
```tsx
<button onClick={() => {
  virtualizer.scrollToIndex(messages.length - 1, {
    align: 'end',
    behavior: 'smooth'
  })
}}>
  Jump to Latest
</button>
```

### 4. Prepend Items (Preserve Scroll Position)
```tsx
const oldSize = virtualizer.getTotalSize()
const oldScroll = parentRef.current?.scrollTop || 0

setMessages(prev => [...newOlderMessages, ...prev])

requestAnimationFrame(() => {
  const newSize = virtualizer.getTotalSize()
  if (parentRef.current) {
    parentRef.current.scrollTop = oldScroll + (newSize - oldSize)
  }
})
```

### 5. Sticky to Bottom (Smart Auto-Scroll)
```tsx
const [atBottom, setAtBottom] = useState(true)

useEffect(() => {
  if (atBottom) {
    virtualizer.scrollToIndex(messages.length - 1, {
      align: 'end',
      behavior: 'smooth'
    })
  }
}, [messages.length])
```

## Key APIs

| Method | Purpose |
|--------|---------|
| `virtualizer.scrollToIndex(index, options)` | Jump to specific message |
| `virtualizer.getTotalSize()` | Get container virtual height |
| `virtualizer.getVirtualItems()` | Get visible items array |
| `virtualizer.measure()` | Force remeasure all items |

## Common Props

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `count` | number | - | Total messages |
| `estimateSize` | fn | - | Guess height (important!) |
| `measureElement` | fn | - | Actual height callback |
| `overscan` | number | 1 | Extra items to render (increase for safety) |

## Anti-Patterns ❌

- ❌ `estimateSize` too small → layout shifts
- ❌ No `overscan` → blank gaps while scrolling
- ❌ `scaleY(-1)` CSS → accessibility issues
- ❌ Prepend without scroll anchoring → jumps
- ❌ Always auto-scroll → confusing when user reads history

## Performance Checklist

- [ ] `overscan >= 10` for smooth scrolling
- [ ] `estimateSize()` returns realistic max height
- [ ] `measureElement` only if variable heights
- [ ] Memoize message items with `React.memo`
- [ ] Debounce scroll handlers if slow

## When to Use Alternatives

| Scenario | Use Instead |
|----------|-------------|
| Pure chat UI (no layout control) | [React Virtuoso](https://virtuoso.dev/) |
| Simple fixed-height list | `react-window` |
| Tables with columns | TanStack Table with virtualization |
| Very simple list | Skip virtualization (< 100 items) |
