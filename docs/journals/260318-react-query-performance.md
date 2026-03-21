# TanStack Query Migration: From Blank Screens to Instant Render

**Date**: 2026-03-18 18:00
**Severity**: High
**Component**: Chat frontend (conversations, messages, caching)
**Status**: Resolved

## What Happened

Shipping TanStack Query v5 migration eliminated the chronic blank screen problem that plagued every workspace and conversation switch. The old manual `useState`+`useEffect` + in-memory LRU cache approach was fundamentally broken. Every navigation cleared state and triggered expensive full refetches. Route changes felt like navigating to a dead page before data arrived.

## The Brutal Truth

This was maddening. We'd already spent weeks trying to optimize around a fundamentally wrong architecture. The 2-second forced splash screen hide was a band-aid masking the real issue: no persistent cache meant every route change was a cold start. The realtime system was also contributing to the problem — every incoming message was triggering a full conversation list refetch (N+1 disaster). Watching users experience 2+ second blank screens on simple conversation switches felt terrible, especially when the data was already loaded seconds before.

## Technical Details

**Before:**
- `use-conversations.ts`: Manual useState, setConversations([]) on workspace change → full refetch
- `use-realtime-messages.ts`: In-memory LRU cache cleared on unmount, fetched from offset 0 on every remount
- Realtime INSERT subscription called `fetchConversations()` for every message (triggered by conversation.last_message update)
- `chat/layout.tsx`: `setTimeout(() => setSplashDone(true), 2000)` hardcoded blank screen delay

**After:**
- `QueryClientProvider` at root with persistent cache (30min gcTime)
- `useConversationsQuery(workspaceId)`: staleTime 60s, survives unmounts
- `useMessagesQuery(conversationId)`: `useInfiniteQuery`, staleTime Infinity (realtime-only freshness)
- Realtime writes directly to cache via `setQueryData` (surgical updates, no full refetch)
- Skeleton screens replace spinners for perceived performance

**Query key strategy:**
```
['conversations', workspaceId]    // 60s stale, background refetch
['messages', conversationId]      // Infinity stale, realtime handles freshness
```

## What We Tried

1. Optimizing the splash screen (reducing 2s to 1.5s) — merely delaying pain, not solving it
2. Tweaking LRU cache size — helped marginally, still flashed on unmount
3. Pre-fetching on workspace switch — complicated, didn't address root cause
4. Adding loading states — masked the problem visually, didn't fix blank screen

All attempts were treating symptoms. The real issue: stateless navigation + no persistent cache.

## Root Cause Analysis

**Architectural mistake:** We conflated React component lifecycle with data availability. When a component unmounts, that doesn't mean the data is stale. The cache should exist independently of render trees. Manual `useState` forced cache lifetime = component lifetime, guaranteeing cold starts on navigation.

**Realtime N+1:** Every new message triggered full conversation list invalidation. With 100+ messages incoming, 100+ full conversation fetches. Classic query optimization miss.

**Splash screen delay:** Symptom, not root. We added artificial delay to hide the real problem instead of eliminating blank screens.

## Lessons Learned

1. **Persistent cache > stateful components:** React Query changed the entire game. Cache persists across unmounts. This is foundational; don't reinvent it.

2. **Surgical realtime updates:** Use `setQueryData` to append/update specific cache entries, not invalidate and refetch. Transforms O(n) queries into O(1) mutations.

3. **Pagination with infinite queries needs care:** Reversed pages (newest first from DB) plus in-memory state requires careful dedup and merge logic. Check `msg.id` before appending.

4. **staleTime is for background refetch, not freshness:** Setting staleTime: Infinity + realtime updates = fresh data without unnecessary requests. Counterintuitive but correct.

5. **Skeleton screens beat spinners:** Perceived performance matters as much as actual performance. Skeleton UI > flip loader spinners because it looks like content is loading, not the app is broken.

## Next Steps

- Monitor query cache hit rates in production (should see 90%+ conversation switches hitting cache)
- Add React Query DevTools to diagnose cache behavior in dev
- Consider `queryFn` retry logic for failed fetches (currently missing)
- Track metrics: average switch time (target <100ms), cache hit rate, realtime update latency
