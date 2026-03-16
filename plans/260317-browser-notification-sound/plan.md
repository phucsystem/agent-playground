# Browser Notification + Sound

**Status:** completed
**Created:** 2026-03-17
**Brainstorm:** `plans/reports/brainstorm-260317-browser-notification-sound.md`

## Summary

Add browser notifications with sound when user receives DMs or @mentions while tab is unfocused. Toggle in user profile dropdown, persisted in DB.

## Phases

| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | DB Migration | completed | 1 migration, 1 type update |
| 2 | Notification Hook | completed | 1 new hook |
| 3 | Sound Asset | completed | 1 audio file |
| 4 | UI Toggle | completed | 1 component update |
| 5 | Layout Integration | completed | 1 layout update |

## Architecture

```
[Supabase Realtime] → global messages channel
        ↓
[useNotificationSound hook]
   ├─ Filter: sender !== self
   ├─ Filter: conversation.type === 'dm' OR content has @currentUser
   ├─ Filter: document.hidden === true
   ├─ Filter: notification_enabled === true
   ├─ Debounce: max 1 per 3s
   ├─ BroadcastChannel: only 1 tab plays
   ├─ Play: /sounds/notification.mp3
   └─ Show: new Notification() (if permission granted)
```

## Key Decisions

- Single boolean toggle (not separate sound/notification toggles) — KISS
- Global realtime subscription in notification hook (separate from per-conversation `useRealtimeMessages`)
- `users_public` view must be updated to expose `notification_enabled`
- Mention detection: simple `@display_name` string match in content
- Graceful degradation: notification permission denied → sound only
