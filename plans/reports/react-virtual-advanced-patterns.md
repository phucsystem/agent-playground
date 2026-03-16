---
title: React Virtual Advanced Patterns for Chat
date: 2026-03-16
type: advanced-guide
---

# Advanced Patterns for React Virtual Chat Implementation

## Problem 1: Prepending Messages Causes Scroll Jump

### Root Cause
When you prepend older messages, the DOM grows at the top. The virtualizer's absolute positioning calculations shift, causing the view to jump.

### Solution: Scroll Offset Anchoring

```tsx
const loadOlderMessages = async () => {
  // 1. Capture scroll state BEFORE adding items
  const prevTotalSize = virtualizer.getTotalSize()
  const prevScrollTop = parentRef.current?.scrollTop || 0

  // 2. Fetch and prepend data
  const older = await API.getOlderMessages(oldestId)
  setMessages(prev => [...older, ...prev])

  // 3. After render, restore scroll position
  // New items added height, so add that to old scroll position
  requestAnimationFrame(() => {
    const newTotalSize = virtualizer.getTotalSize()
    const sizeDiff = newTotalSize - prevTotalSize

    if (parentRef.current) {
      parentRef.current.scrollTop = prevScrollTop + sizeDiff
    }
  })
}
```

**Why `requestAnimationFrame`?**
- Lets React commit DOM changes first
- Virtualizer measures items after render
- Ensures `getTotalSize()` is accurate

**Alternative: Use Intersection Observer**
```tsx
useEffect(() => {
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && hasMore && !loading) {
      loadOlderMessages()
    }
  }, { threshold: 0.1 })

  if (topSentinelRef.current) observer.observe(topSentinelRef.current)
  return () => observer.disconnect()
}, [hasMore, loading])
```

---

## Problem 2: Dynamic Height Items Cause Layout Shift

### Root Cause
`estimateSize()` returns a guess. When actual height differs, virtualizer recalculates, shifting everything.

### Solution: Progressive Measurement Refinement

```tsx
interface Message {
  id: string
  content: string
  measuredHeight?: number // cache actual height
}

const estimateSize = useCallback((index: number) => {
  const msg = messages[index]

  // If we already measured this item, use actual height
  if (msg.measuredHeight) {
    return msg.measuredHeight
  }

  // Otherwise, estimate conservatively (larger is better)
  if (msg.content.length > 200) return 120
  if (msg.content.includes('\n')) return 80
  return 60
}, [messages])

const virtualizer = useVirtualizer({
  count: messages.length,
  getScrollElement: () => parentRef.current,
  estimateSize,
  measureElement: typeof window !== 'undefined'
    ? element => element?.getBoundingClientRect().height
    : undefined,
  overscan: 15, // increase to prevent gaps during measurement
})

// Cache measured height in message state
const cacheMessageHeight = useCallback((index: number, height: number) => {
  setMessages(prev => {
    const updated = [...prev]
    updated[index] = { ...updated[index], measuredHeight: height }
    return updated
  })
}, [])
```

**In your message component:**
```tsx
<div
  ref={(el) => {
    if (el && !message.measuredHeight) {
      const height = el.getBoundingClientRect().height
      cacheMessageHeight(index, height)
    }
  }}
>
  {message.content}
</div>
```

---

## Problem 3: Images Not Loading Before Scroll Position Calculated

### Root Cause
Images are lazy-loaded. `estimateSize()` fires before image loads. When image loads, layout shifts.

### Solution: Measure Image, Update Message Height

```tsx
interface Message {
  id: string
  type: 'text' | 'image'
  content: string
  imageHeight?: number // add this
}

// Estimate needs to know actual image dimensions
const estimateSize = useCallback((index: number) => {
  const msg = messages[index]
  if (msg.type === 'image' && msg.imageHeight) {
    return msg.imageHeight + 40 // padding
  }
  if (msg.type === 'image') return 350 // default estimate
  return 60
}, [messages])

// Message component
const ChatImage = ({ message, onImageLoad }: {
  message: Message,
  onImageLoad: (width: number, height: number) => void
}) => {
  return (
    <img
      src={message.content}
      alt=""
      onLoad={(e) => {
        const img = e.currentTarget
        onImageLoad(img.naturalWidth, img.naturalHeight)
      }}
      style={{ maxWidth: '100%', height: 'auto' }}
    />
  )
}

// Parent component
const handleImageLoad = useCallback((msgIndex: number, width: number, height: number) => {
  // Calculate actual message height (image + padding)
  const scaledHeight = Math.min(height, 400) // max height
  const msgHeight = scaledHeight + 40

  setMessages(prev => {
    const updated = [...prev]
    updated[msgIndex] = {
      ...updated[msgIndex],
      imageHeight: msgHeight
    }
    return updated
  })

  // Force remeasure
  virtualizer.measure()
}, [virtualizer])
```

---

## Problem 4: Auto-Scroll Too Aggressive (User Reading History)

### Root Cause
Every new message triggers scroll, even if user scrolled up to read old messages.

### Solution: Sticky-to-Bottom Logic

```tsx
const [wasAtBottom, setWasAtBottom] = useState(true)
const scrollDebounceRef = useRef<NodeJS.Timeout>()

const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
  // Debounce scroll detection
  clearTimeout(scrollDebounceRef.current)

  scrollDebounceRef.current = setTimeout(() => {
    const el = e.currentTarget
    const THRESHOLD = 150 // px from bottom
    const isAtBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < THRESHOLD

    setWasAtBottom(isAtBottom)
  }, 100)
}, [])

// Only auto-scroll if user was at bottom
useEffect(() => {
  if (wasAtBottom && messages.length > previousLengthRef.current) {
    virtualizer.scrollToIndex(messages.length - 1, {
      align: 'end',
      behavior: 'smooth'
    })
  }
  previousLengthRef.current = messages.length
}, [messages.length, wasAtBottom, virtualizer])

// Show "scroll to latest" button when user scrolled up
return (
  <div>
    <div ref={parentRef} onScroll={handleScroll}>
      {/* virtualizer content */}
    </div>
    {!wasAtBottom && (
      <button onClick={() => {
        virtualizer.scrollToIndex(messages.length - 1, {
          align: 'end',
          behavior: 'smooth'
        })
        setWasAtBottom(true)
      }}>
        New messages - Jump to bottom ↓
      </button>
    )}
  </div>
)
```

---

## Problem 5: Performance Degrades with 10K+ Messages

### Root Cause
Measuring every item adds DOM operations. Overscan too high = many rendered items.

### Solution: Lazy Measurement + Smart Overscan

```tsx
// 1. Only measure first N items, estimate the rest
const shouldMeasureItem = (index: number) => index < 100

// 2. Adaptive overscan based on device speed
const getAdaptiveOverscan = () => {
  const cores = navigator.hardwareConcurrency || 4
  if (cores <= 2) return 5
  if (cores <= 4) return 10
  return 20
}

// 3. Debounce measurement callback
const measureDebounceRef = useRef<NodeJS.Timeout>()
const measureElement = useCallback((el: Element | null) => {
  if (!el) return 0
  clearTimeout(measureDebounceRef.current)

  return el.getBoundingClientRect().height
}, [])

const virtualizer = useVirtualizer({
  count: messages.length,
  getScrollElement: () => parentRef.current,
  estimateSize: (index) => {
    // Assume similar height after first 100 items
    if (index < 100) {
      return messages[index].measuredHeight || 60
    }
    return 60
  },
  measureElement: shouldMeasureItem(messages.length) ? measureElement : undefined,
  overscan: getAdaptiveOverscan(),
})
```

---

## Problem 6: Reverse Scrolling Accessibility (Screen Readers)

### Root Cause
`flex-direction: column-reverse` visually reverses but DOM order stays same → confusing for screen readers.

### Solution: Semantic HTML + ARIA

```tsx
<div
  ref={parentRef}
  style={{
    height: '400px',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column-reverse'
  }}
  role="log" // announce new messages
  aria-label="Chat messages"
  aria-live="polite" // announces changes
>
  <div role="list">
    {virtualizer.getVirtualItems().map(vItem => (
      <div
        key={messages[vItem.index].id}
        role="listitem"
        aria-label={`Message from ${messages[vItem.index].author}`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: vItem.size,
          transform: `translateY(${vItem.start}px)`
        }}
      >
        {messages[vItem.index].text}
      </div>
    ))}
  </div>
</div>
```

**Note:** `aria-live="polite"` on flex-reversed container may have mixed screen reader support. Consider announcing new messages via separate aria-live region:

```tsx
const [latestMessage, setLatestMessage] = useState('')

useEffect(() => {
  if (wasAtBottom && messages.length > prevLength) {
    setLatestMessage(`New message: ${messages[messages.length - 1].text}`)
  }
}, [messages.length])

return (
  <div aria-live="polite" aria-atomic="true" className="sr-only">
    {latestMessage}
  </div>
)
```

---

## Problem 7: Memory Leak with Large Message Lists

### Root Cause
Message array never garbage collected if references held in closures or caches.

### Solution: Bounded Cache + Pagination

```tsx
const MAX_LOADED_MESSAGES = 1000

// Only keep recent 1000 messages in memory
const trimmedMessages = useMemo(() => {
  if (messages.length <= MAX_LOADED_MESSAGES) return messages
  return messages.slice(-MAX_LOADED_MESSAGES)
}, [messages])

// Adjust virtualizer count
const virtualizer = useVirtualizer({
  count: trimmedMessages.length,
  // ... other config
})

// Track offset in database
const [messageOffset, setMessageOffset] = useState(0)

const loadOlderMessages = async () => {
  const offset = messageOffset + trimmedMessages.length
  const older = await API.getOlderMessages(offset, limit: 50)

  // Remove newest messages if at max, prepend older ones
  setMessages(prev => {
    let updated = [...older, ...prev]
    if (updated.length > MAX_LOADED_MESSAGES) {
      updated = updated.slice(-MAX_LOADED_MESSAGES)
    }
    return updated
  })

  setMessageOffset(offset)
}
```

---

## Recommended Config for Different Scenarios

### Light Chat (< 100 messages)
```tsx
{
  estimateSize: () => 60,
  overscan: 5,
  // skip measureElement
}
```

### Normal Chat (100-1000 messages with images)
```tsx
{
  estimateSize: () => 100,
  measureElement: el => el?.getBoundingClientRect().height,
  overscan: 10,
}
```

### Heavy Chat (1000+ messages, real-time)
```tsx
{
  estimateSize: () => 80,
  measureElement: el => el?.getBoundingClientRect().height,
  overscan: 20,
  useFlushSync: false, // disable for React 19 or slow devices
}
```

### Chat with Lots of Images
```tsx
{
  estimateSize: (index) => {
    const msg = messages[index]
    if (msg.type === 'image') return 350
    return 60
  },
  measureElement: el => el?.getBoundingClientRect().height,
  overscan: 15,
}
```

---

## Testing Patterns

### Unit Test: Scroll Position Anchoring
```tsx
test('prepending messages preserves scroll position', () => {
  const { getByTestId } = render(<ChatList messages={initial} />)
  const container = getByTestId('chat-container')

  // Scroll to middle
  container.scrollTop = 500

  // Prepend 10 messages
  rerender(<ChatList messages={[...new10, ...initial]} />)

  // Scroll should move down by height of new messages
  expect(container.scrollTop).toBeGreaterThan(500)
})
```

### E2E Test: Auto-Scroll Sticky
```tsx
// User scrolls up
await page.evaluate(() => {
  const el = document.querySelector('[data-testid="chat"]')
  el.scrollTop = el.scrollHeight / 2
})

// New message arrives
await sendMessage('Hello')

// Should NOT auto-scroll (user reading history)
await expect(page).toHaveValue('[data-testid="scroll-button"]', 'visible')
```

---

## When to Migrate to React Virtuoso

Consider React Virtuoso if:
- ✗ Reverse scrolling logic becomes too complex
- ✗ Dynamic heights are causing performance issues
- ✗ You need built-in "scroll to bottom" behavior
- ✓ Pure chat UI (not complex layouts)

```tsx
// React Virtuoso equivalent is much simpler:
import { MessageList } from 'react-virtuoso'

<MessageList
  style={{ height: '400px' }}
  data={messages}
  itemContent={(index, message) => <MessageRow message={message} />}
  followOutput="smooth"
/>
```

---

## Debugging Checklist

- [ ] `estimateSize()` realistic? (test with `console.log`)
- [ ] `overscan` >= 10?
- [ ] `measureElement` returning correct height?
- [ ] Scroll anchoring logic correct? (test with older messages load)
- [ ] `wasAtBottom` state updating? (check with React DevTools)
- [ ] Image dimensions known before render?
- [ ] Memory usage stable? (Chrome DevTools > Memory)
- [ ] Scroll smooth? (60 FPS on target devices?)
