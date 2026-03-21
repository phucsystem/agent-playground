---
title: Sidebar Realtime Fixes
status: complete
created: 2026-03-18
priority: high
---

# Sidebar Realtime Fixes

## Problem
New groups created by admin not visible in sidebar until realtime fires (100ms–2s delay).
Additionally, realtime subscription has reliability and performance gaps.

## Phases

| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | [Immediate refetch after group creation](phase-01-immediate-refetch.md) | complete | `layout.tsx`, `create-group-dialog.tsx` |
| 2 | [Realtime reconnect handling](phase-02-reconnect-handling.md) | complete | `use-conversations.ts` |
| 3 | [Watch conversation_members inserts](phase-03-member-subscription.md) | complete | `use-conversations.ts` |
| 4 | [Filter conversations subscription](phase-04-subscription-filter.md) | complete | `use-conversations.ts` |

## Key Files
- `src/hooks/use-conversations.ts` — realtime subscription hub
- `src/components/sidebar/create-group-dialog.tsx` — group creation dialog
- `src/app/chat/layout.tsx` — orchestrator, mounts CreateGroupDialog

## Dependencies
- Phases 2–4 are all in `use-conversations.ts` and can be done together
- Phase 1 requires prop chain change in layout → dialog

## Notes
- `messages` and `conversation_members` tables have no `workspace_id` — filter only applicable to `conversations` table
- NO supabase migrations
- NO auto-commit
