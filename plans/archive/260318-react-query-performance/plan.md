---
title: "React Query Performance Migration"
description: "Eliminate blank screens on conversation/workspace switching via TanStack Query v5 + realtime cache writes + skeleton screens"
status: completed
priority: P1
effort: 7h
branch: feat/react-query-performance
tags: [performance, react-query, ux, caching]
created: 2026-03-18
completed: 2026-03-18
---

# React Query Performance Migration

## Problem

Every route/workspace change causes blank screens because:
1. `use-conversations.ts` uses manual `useState`+`useEffect` -- workspace switch clears state (`setConversations([])`) then full refetches
2. `use-realtime-messages.ts` has in-memory LRU cache but still calls `fetchMessages(0)` on every mount -- causes flicker
3. Realtime subscriptions trigger full `fetchConversations()` on every message INSERT (N+1 problem)
4. **Critical:** `chat/layout.tsx` has hardcoded `setTimeout(() => setSplashDone(true), 2000)` forcing 2s blank on every load

## Solution

Replace manual fetch/cache with TanStack Query v5:
- Persistent query cache survives component unmounts -- no blank on navigate
- Realtime writes directly to cache (`setQueryData`) instead of full refetch
- `staleTime` prevents unnecessary refetches
- Skeleton screens replace FlipLoader spinners for perceived performance

## Architecture

```
QueryClientProvider (root layout)
  |
  +-- useConversationsQuery(workspaceId)     // useQuery, key: ['conversations', wsId]
  |     +-- realtime: invalidateQueries on conversation changes
  |     +-- realtime: invalidateQueries on message INSERT (updates last_message)
  |
  +-- useMessagesQuery(conversationId)       // useInfiniteQuery, key: ['messages', convId]
  |     +-- realtime: setQueryData on message INSERT (surgical append)
  |     +-- staleTime: Infinity (realtime handles freshness)
  |
  +-- Skeleton screens (conversation list, message list)
```

## Query Keys

| Key | staleTime | gcTime | Notes |
|-----|-----------|--------|-------|
| `['conversations', workspaceId]` | 60s | 30min | Background refetch on stale |
| `['messages', conversationId]` | Infinity | 30min | Realtime-only updates |

## Phases

| # | Phase | Effort | Status | Files |
|---|-------|--------|--------|-------|
| 1 | [Setup & Splash Fix](./phase-01-setup.md) | 0.5h | completed | layout.tsx, package.json, query-client.ts |
| 2 | [Conversations Migration](./phase-02-conversations.md) | 2h | completed | use-conversations.ts, conversations-context.tsx |
| 3 | [Messages Migration](./phase-03-messages.md) | 3h | completed | use-realtime-messages.ts |
| 4 | [Skeleton Screens](./phase-04-skeletons.md) | 1.5h | completed | skeleton.tsx, conversation-list, message-list |

## Key Risks

- **Realtime dedup:** Must check `msg.id` before appending to avoid duplicates from both realtime + background refetch
- **Pagination:** `useInfiniteQuery` pages are reversed (newest first from DB) -- must handle merge carefully
- **Context provider interface:** `ConversationsProvider` and consumers must keep same API shape to minimize blast radius

## Success Criteria

- Switching conversations: instant render from cache (0ms blank)
- Switching workspaces: stale conversations show immediately, background update
- No 2s forced splash screen
- Realtime still delivers live updates correctly
- No duplicate messages
