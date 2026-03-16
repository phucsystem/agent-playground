# Brainstorm: Browser Notification + Sound

**Date:** 2026-03-17
**Status:** Agreed
**Feature:** Browser notification with sound when tab unfocused, user-toggleable

---

## Requirements

| Aspect | Decision |
|--------|----------|
| **Triggers** | New DMs + @mentions |
| **When** | Tab unfocused only (`document.hidden === true`) |
| **Sound** | Short subtle tone (~0.5s chime file) |
| **Toggle UI** | User profile dropdown in sidebar |
| **Storage** | Database column on users table |
| **Default** | Enabled |

---

## Evaluated Approaches

### A: Single Hook + Native Notification API
- Simple, ~1 hook + 1 toggle
- Requires `Notification.requestPermission()` — blocks if denied
- No fallback if permission denied

### B: Sound-Only + Enhanced Toast (No Native Notification)
- No permission prompt needed
- No OS-level notification — sound is only signal when unfocused
- Simpler but less capable

### C: Native Notification + Sound (SELECTED)
- Best UX — OS notification + sound
- Graceful degradation: permission denied → sound only
- Native notifications clickable → focus tab + navigate to conversation
- Industry standard (Slack, Discord, Teams)

---

## Recommended Solution: Approach C

### Implementation Shape

1. **DB Migration**: Add `notification_enabled` boolean to `users` table (default: `true`)
2. **Hook**: `useNotificationSound.ts`
   - Listen to new messages from realtime subscription
   - Filter: is DM OR message contains @mention of current user
   - Check: `document.hidden === true`
   - Check: user preference (`notification_enabled`)
   - Fire: `new Notification()` + `new Audio('/sounds/notification.mp3').play()`
3. **Audio file**: `/public/sounds/notification.mp3` (~0.5s chime, ~5KB)
4. **UI**: Toggle switch in `user-profile.tsx` dropdown
5. **Permission**: Request on first toggle-on, remember state

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| Single boolean toggle | KISS — one switch controls both notification + sound |
| Default: enabled | Chat apps expect notifications. Opt-out > opt-in |
| DB column not JSON | Single pref → single column. YAGNI on preferences JSON blob |
| Filter in hook, not DB | DM detection + mention parsing is client-side logic |
| Audio file, not Web Audio API | Real chime sounds better than synthesized beep |

### DM Detection Logic
- Check `conversation.is_direct` field from message's conversation metadata
- Already available in conversation data from Supabase

### Mention Detection Logic
- Parse message `content` for `@displayName` matching current user
- Reuse existing mention-picker pattern

### Multi-Tab Coordination
- Use `BroadcastChannel` API to ensure only one tab fires sound
- Leader election: first tab to receive message claims it, broadcasts to others "handled"

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Browser blocks autoplay audio | Audio plays after user interaction (tab was focused before). Modern browsers allow after first gesture |
| User denies notification permission | Sound still works. Toast shows on tab return |
| Multiple tabs → duplicate sounds | `BroadcastChannel` coordination — one tab plays |
| Mobile Safari no Notification API | Sound fallback works. Feature degrades gracefully |
| User revokes permission in browser settings | Check `Notification.permission` before each attempt, fall back to sound |

---

## Edge Cases

- **Multiple tabs**: `BroadcastChannel` ensures single sound playback
- **Tab returns to focus**: Clear pending state, don't replay
- **User is sender**: Never notify for own messages
- **Agent messages in DM**: Treated as DM — notifies
- **Rapid messages**: Debounce sound (max 1 per 3s) to avoid spam

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/015_notification_preferences.sql` | Create — add column |
| `src/hooks/use-notification-sound.ts` | Create — core logic |
| `src/types/database.ts` | Modify — add field to User type |
| `src/components/sidebar/user-profile.tsx` | Modify — add toggle |
| `public/sounds/notification.mp3` | Create — chime audio file |
| `src/app/chat/layout.tsx` | Modify — mount hook |

---

## Success Criteria

- [ ] Sound plays when DM received + tab unfocused
- [ ] Sound plays when @mentioned + tab unfocused
- [ ] Native notification shows (if permission granted)
- [ ] No sound/notification when tab focused
- [ ] No sound/notification for own messages
- [ ] Toggle in profile dropdown works
- [ ] Preference persists across devices (DB)
- [ ] Only one tab plays sound (multi-tab)
- [ ] Sound debounced (max 1 per 3s)
