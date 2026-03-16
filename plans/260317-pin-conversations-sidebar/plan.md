---
status: completed
created: 2026-03-17
slug: pin-conversations-sidebar
---

# Plan: Pin Conversations in Sidebar

## Summary

Add pin-to-top functionality for sidebar conversations. Pinned conversations float to top of their section (DMs/Groups), sorted alphabetically. Unpinned keep auto-sort by recency. Persisted in localStorage per user. Zero new dependencies.

## Context

- Brainstorm: `plans/reports/brainstorm-260317-pin-conversations-sidebar.md`
- Current sidebar: 3 sections (DMs, Active Groups, Archived) sorted by `updated_at` DESC
- No existing pin/reorder functionality

## Phases

| # | Phase | Status | Effort |
|---|-------|--------|--------|
| 1 | Hook: `use-pinned-conversations.ts` | completed | S |
| 2 | Sort logic + pin UI in `conversation-list.tsx` | completed | M |

## Key Decisions

- **No DB changes** — localStorage only
- **No new dependencies** — native React + DOM
- **Pin icon on hover** — appears right side of conversation item
- **Pinned sort** — alphabetical within pinned group
- **Sections affected** — DMs and Active Groups only (not Archived)

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/use-pinned-conversations.ts` | CREATE | localStorage hook for pin state |
| `src/components/sidebar/conversation-list.tsx` | MODIFY | Sort logic, pin icon, visual separator |
| `src/components/sidebar/sidebar.tsx` | MODIFY | Pass `currentUserId` to ConversationList |

## Success Criteria

- [ ] Pin/unpin any DM or group via hover icon
- [ ] Pinned float to top of their section with visual separator
- [ ] Pins persist across page reloads
- [ ] No regression to existing conversation list behavior
- [ ] Clean stale pins (deleted/archived conversations)
