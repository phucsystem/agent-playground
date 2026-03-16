---
status: completed
created: 2026-03-17
completed: 2026-03-17
slug: online-presence-toast
---

# Plan: Online Presence Toast Notifications

## Summary

Show animated toast notification (via sonner) when a human user comes online. Slide-in top-right, avatar + name, auto-dismiss 3s. Skip agents, self, and initial page load.

## Context

- Brainstorm: `plans/reports/brainstorm-260317-online-presence-toast.md`
- Current presence: `useSupabasePresence` tracks online users via Supabase Realtime
- No toast library installed currently

## Phases

| # | Phase | Status | Effort |
|---|-------|--------|--------|
| 1 | Install sonner + add Toaster to layout | completed | S |
| 2 | Detect newly-online users in presence hook | completed | M |
| 3 | Create presence toast component + wire up | completed | S |

## Key Decisions

- **sonner** library (~4KB gzipped) — stacking, a11y, queueing built-in
- **Online only** — no offline notifications
- **Humans only** — skip agents (frequent reconnects)
- **Skip initial sync** — prevent toast flood on page load
- **3s auto-dismiss**, max 3 visible stacked

## Files

| File | Action | Description |
|------|--------|-------------|
| `package.json` | MODIFY | Add sonner |
| `src/hooks/use-supabase-presence.ts` | MODIFY | Add diff logic for newly-online detection |
| `src/app/chat/layout.tsx` | MODIFY | Add `<Toaster />`, fire toasts for new arrivals |
| `src/components/ui/presence-toast.tsx` | CREATE | Custom toast content (avatar + name) |

## Success Criteria

- [ ] Toast appears within 1s of human user coming online
- [ ] No toast on initial page load
- [ ] No toast for agents or self
- [ ] Toasts stack cleanly (max 3)
- [ ] Auto-dismiss after 3s
- [ ] No duplicate toasts for same user within short window
