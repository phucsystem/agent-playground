# Brainstorm: Online Presence Toast Notifications

**Date:** 2026-03-17
**Status:** Agreed
**Scope:** Animated toast notification when human users come online

---

## Problem

No visual feedback when users come online. Green dots update silently — easy to miss new arrivals in sidebar.

## Chosen Approach

Toast notification via **sonner** library (~4KB gzipped). Slide-in toast top-right showing avatar + name + "is now online". Auto-dismiss 3s.

## Key Decisions

- **sonner** over custom component — battle-tested stacking/queueing/a11y, useful for future toasts
- **Online only** — no offline notifications (less noise)
- **All users** — not filtered by DM contacts or pins
- **Humans only** — skip agents (frequent reconnects would spam)
- **Skip initial load** — first sync treated as initial state, not "new arrivals"

## Architecture

```
useSupabasePresence (modified)
  → useRef to track previousOnlineIds
  → diff current vs previous on each sync
  → return newlyOnlineUsers[] (human, non-self)
        ↓
ChatLayout
  → consumes newlyOnlineUsers[]
  → useEffect fires toast.custom() per new user
  → <Toaster /> rendered in layout
```

## Toast Design

- Position: top-right
- Content: Avatar (sm) + "{name} is now online"
- Accent: green left border (--color-success)
- Duration: 3 seconds auto-dismiss
- Max visible: 3 (sonner default stacking)
- Animation: slide-in from right, fade-out

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `package.json` | MODIFY | Add sonner dependency |
| `src/hooks/use-supabase-presence.ts` | MODIFY | Diff logic for newly-online detection |
| `src/app/chat/layout.tsx` | MODIFY | Add `<Toaster />`, consume newlyOnlineUsers, fire toasts |
| `src/components/ui/presence-toast.tsx` | CREATE | Custom toast content component (avatar + name) |

## Edge Cases

- **Initial load:** Skip first sync to avoid flooding toasts for all online users
- **Tab switch:** Supabase may re-sync on tab focus — guard against duplicate toasts
- **Rapid reconnect:** User flickers online/offline quickly — debounce or deduplicate within window
- **Current user:** Never toast for self coming online

## Risks

- **Low:** Sonner adds 4KB to bundle. Acceptable tradeoff for built-in a11y + stacking.
- **Low:** Supabase presence sync can batch multiple users — handle array, not single user.

## Success Criteria

- Toast appears within 1s of user coming online
- No toast on initial page load
- No toast for agents or self
- Toasts stack cleanly (max 3 visible)
- Auto-dismiss after 3s
- No duplicate toasts for same user within short window
