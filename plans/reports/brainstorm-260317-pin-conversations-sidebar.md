# Brainstorm: Pin Conversations in Sidebar

**Date:** 2026-03-17
**Status:** Agreed
**Scope:** Sidebar conversation organization via pinning

---

## Problem

Growing conversation list makes it hard to find frequently-used conversations. Currently sorted only by most-recent-message, no manual organization.

## Evaluated Approaches

### A: Pin-only (simplest) ← CHOSEN
- Pin icon on hover to toggle pin/unpin
- Pinned float to top of each section, sorted alphabetically
- Unpinned keep auto-sort by recency
- localStorage persistence
- Zero new dependencies

### B: Pin + drag-drop reorder pinned
- Same as A but drag-drop to reorder within pinned group
- Requires @dnd-kit/core (~15KB gzipped)
- Overkill for current needs

### C: Full drag-drop everywhere
- Drag any conversation to reorder within/between sections
- Loses auto-sort by recency entirely
- High complexity, poor ROI for invite-only platform

## Final Solution

### UX
- Hover conversation → pin icon appears on right
- Click to pin/unpin
- Pinned items show subtle pin indicator when not hovered
- Visual separator between pinned and unpinned
- Mobile: pin icon always visible (no hover state)

### Persistence
```
localStorage key: `pinned-conversations-{userId}`
value: ["conv-uuid-1", "conv-uuid-2", ...]
```

### Sort Logic
1. Pinned conversations → top of section, sorted alphabetically
2. Unpinned conversations → below, sorted by `updated_at` DESC

### Files to Modify
- `src/components/sidebar/conversation-list.tsx` — sort logic + pin icon UI
- New: `src/hooks/use-pinned-conversations.ts` — localStorage read/write hook

### Edge Cases
- Pinned conv deleted/archived → silently remove from pinned list
- localStorage cleared → pins lost (acceptable)
- Pin icon vs unread badge → careful layout in 260px sidebar

### Upgrade Path
- Add drag-drop to pinned section later if needed
- Server-side persistence: add `pinned_at` column to `conversation_members`

## Success Criteria
- Pin/unpin any conversation via hover icon
- Pinned appear at top of their section with separator
- Pins persist across page reloads
- No regression to existing behavior
