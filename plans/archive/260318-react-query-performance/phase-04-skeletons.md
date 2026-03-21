# Phase 4: Skeleton Screens

## Overview
- **Priority:** Medium
- **Status:** Completed
- **Effort:** 1.5h
- **Depends on:** Phase 2, Phase 3

Replace `FlipLoader` full-page spinners with contextual skeleton shimmer components. Users see structural previews instead of blank screens during initial loads.

## Key Insights

- `FlipLoader` is used in 3 places: chat layout (workspace loading), chat layout (user loading), message-list (messages loading)
- After React Query migration (phases 2-3), loading states trigger much less often -- skeletons are for cold starts only
- Tailwind CSS animation `animate-pulse` provides shimmer effect with zero JS overhead
- Conversation list skeleton should match the actual `ConversationItem` layout (avatar + 2 text lines)
- Message list skeleton should show alternating left/right bubbles matching `MessageItem` structure

## Requirements

### Functional
- FR-1: Conversation sidebar shows 6-8 shimmer rows during initial load
- FR-2: Message list shows 5-6 shimmer bubbles during initial load
- FR-3: Workspace loading shows skeleton layout instead of FlipLoader
- FR-4: Skeletons match spatial layout of actual content (same widths, heights, gaps)

### Non-Functional
- NFR-1: No additional JS bundle -- CSS-only animation via Tailwind `animate-pulse`
- NFR-2: Skeleton components are reusable and self-contained
- NFR-3: Respect dark/light mode if applicable (use neutral colors)

## Related Code Files

### Files to Create
- `src/components/ui/skeleton.tsx` -- Base skeleton primitive
- `src/components/sidebar/conversation-list-skeleton.tsx` -- Sidebar shimmer rows
- `src/components/chat/message-list-skeleton.tsx` -- Message bubbles shimmer

### Files to Modify
- `src/app/chat/layout.tsx` -- Replace FlipLoader in workspace loading state
- `src/components/chat/message-list.tsx` -- Replace FlipLoader in messages loading state

## Implementation Steps

### 1. Create `src/components/ui/skeleton.tsx`

```tsx
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-neutral-200 ${className}`}
    />
  );
}
```

### 2. Create `src/components/sidebar/conversation-list-skeleton.tsx`

Match `ConversationItem` layout: 32px avatar circle + 2 lines of text.

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export function ConversationListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-1 px-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-2.5 px-2 py-1.5">
          <Skeleton className="w-8 h-8 rounded-full shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 3. Create `src/components/chat/message-list-skeleton.tsx`

Alternating left/right message bubbles to match chat UI.

```tsx
import { Skeleton } from "@/components/ui/skeleton";

const BUBBLE_PATTERNS = [
  { align: "left", width: "w-48" },
  { align: "left", width: "w-64" },
  { align: "right", width: "w-56" },
  { align: "left", width: "w-40" },
  { align: "right", width: "w-52" },
  { align: "left", width: "w-60" },
];

export function MessageListSkeleton() {
  return (
    <div className="flex-1 flex flex-col justify-end gap-3 p-4">
      {BUBBLE_PATTERNS.map((pattern, index) => (
        <div
          key={index}
          className={`flex ${
            pattern.align === "right" ? "justify-end" : "justify-start"
          }`}
        >
          <div className={`flex items-end gap-2 ${pattern.align === "right" ? "flex-row-reverse" : ""}`}>
            {pattern.align === "left" && (
              <Skeleton className="w-7 h-7 rounded-full shrink-0" />
            )}
            <Skeleton className={`h-10 ${pattern.width} rounded-2xl`} />
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 4. Update `src/app/chat/layout.tsx` -- workspace loading

Replace:
```tsx
if (workspaceLoading) {
  return (
    <div className="min-h-dvh flex items-center justify-center">
      <FlipLoader size="lg" label="Loading..." />
    </div>
  );
}
```

With skeleton layout matching the actual UI structure:
```tsx
if (workspaceLoading) {
  return (
    <div className="flex h-dvh">
      <div className="hidden md:flex w-[60px] shrink-0 bg-gradient-to-b from-primary-950 via-primary-900 to-primary-950" />
      <div className="w-[260px] shrink-0 border-r border-neutral-100 bg-white pt-4">
        <ConversationListSkeleton />
      </div>
      <div className="flex-1">
        <MessageListSkeleton />
      </div>
    </div>
  );
}
```

### 5. Update `src/components/chat/message-list.tsx` -- messages loading

Replace the FlipLoader block (around line 158):
```tsx
// Before
if (loading && messages.length === 0) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <FlipLoader size="lg" label="Loading..." />
    </div>
  );
}

// After
if (loading && messages.length === 0) {
  return <MessageListSkeleton />;
}
```

Add import:
```tsx
import { MessageListSkeleton } from "./message-list-skeleton";
```

### 6. Clean up unused FlipLoader imports

After replacing all usages, check if FlipLoader import can be removed from:
- `src/app/chat/layout.tsx` -- keep if still used in user loading state
- `src/components/chat/message-list.tsx` -- remove

Note: Keep FlipLoader in chat/layout.tsx for the `if (userLoading)` guard -- that's a brief initial auth check, not a data loading state. Could replace later but out of scope.

## Todo List

- [x] Create `src/components/ui/skeleton.tsx`
- [x] Create `src/components/sidebar/conversation-list-skeleton.tsx`
- [x] Create `src/components/chat/message-list-skeleton.tsx`
- [x] Update `src/app/chat/layout.tsx` -- replace workspace loading FlipLoader
- [x] Update `src/components/chat/message-list.tsx` -- replace messages loading FlipLoader
- [x] Remove unused FlipLoader imports where applicable
- [x] Visual QA: verify skeletons match actual content layout
- [x] Verify build compiles

## Success Criteria

- No full-page spinner for workspace loading -- structural skeleton shown instead
- No full-page spinner for message loading -- bubble skeletons shown instead
- Skeletons spatially match actual content (no layout shift on data load)
- Smooth `animate-pulse` animation
- No additional JS bundle size from skeleton components

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Skeleton layout mismatch | Low -- layout shift when real content loads | Match exact padding, gaps, and sizes from ConversationItem and MessageItem |
| Dark mode incompatibility | Low -- bg-neutral-200 may not work | Use neutral-200/neutral-700 with dark: variant if project has dark mode |
| FlipLoader still needed elsewhere | Low -- removing import breaks | Check all FlipLoader usages before removing; keep in layout for userLoading |
