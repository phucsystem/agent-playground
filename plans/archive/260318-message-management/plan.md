# Message Management v0.3.0

**Created:** 2026-03-18
**Status:** Complete
**Effort:** M (medium)
**Priority:** High (compliance + UX)

## Summary

Add edit, delete, and retention features for messages. Users can edit their own messages (with "edited" audit trail), soft-delete messages, and admins can manage message retention policies and view audit logs.

## Phases

| Phase | Name | Status | Effort | Description |
|-------|------|--------|--------|-------------|
| 01 | Database Schema | ✅ | S | Migration: add columns + RLS policies + functions |
| 02 | API & Hooks | ✅ | S | Backend logic: edit/delete endpoints + React Query hooks |
| 03 | Chat UI | ✅ | M | Message context menu, edit mode, delete confirmation |
| 04 | Realtime Sync | ✅ | S | UPDATE/DELETE realtime handlers + cache updates |
| 05 | Admin Audit | ✅ | S | Admin audit log viewing + retention policy |

## Architecture Decisions

### Edit Messages
- Add `edited_at` (timestamptz) and `is_deleted` (boolean) columns to `messages` table
- Store original content in `metadata.edit_history[]` array (JSONB) — lightweight, no extra table
- RLS: only sender can UPDATE their own messages (within conversation membership)
- Webhook notification: dispatch `message.updated` event to agents in conversation

### Delete Messages
- **Soft delete**: set `is_deleted = true`, replace content with empty string
- Preserve message row for audit trail (admin can still see deleted messages)
- RLS: sender can delete own messages; conversation admin can delete any message in conversation; global admin can delete any
- UI: show "This message was deleted" placeholder
- Webhook: dispatch `message.deleted` event

### Retention Policy (Admin)
- Cron-based approach via Supabase pg_cron (if available) or scheduled Edge Function
- Admin sets retention days per workspace (default: no limit)
- Add `message_retention_days` column to `workspaces` table (nullable integer)
- Messages older than retention period → auto soft-deleted
- **Deferred to post-MVP**: Start with manual admin delete; add automated retention later

### What We're NOT Building
- Message version history UI (just show "edited" badge)
- Undo delete (soft delete is recoverable by admin only)
- Bulk message management
- Per-conversation retention (workspace-level only)

## Dependencies

- Existing: messages table, RLS policies, realtime subscriptions, React Query cache
- New migration: 021_message_management.sql
- Webhook dispatch Edge Function needs UPDATE/DELETE event support

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Webhook dispatch only fires on INSERT | Medium | Add database webhook for UPDATE events or handle via Edge Function |
| Edit history bloats metadata JSONB | Low | Limit edit_history to last 5 edits |
| Soft delete breaks unread count | Low | Exclude is_deleted from unread count query |
| Realtime UPDATE events not subscribed | Medium | Add UPDATE subscription to use-realtime-messages hook |

## File Impact

### New Files
- `supabase/migrations/021_message_management.sql`

### Modified Files
- `src/hooks/use-realtime-messages.ts` — UPDATE/DELETE handlers
- `src/components/chat/message-item.tsx` — edit/delete UI, "edited" badge, "deleted" state
- `src/components/chat/message-list.tsx` — pass edit/delete handlers
- `src/components/chat/chat-input.tsx` — edit mode (pre-fill content)
- `src/app/chat/[conversationId]/page.tsx` — wire edit/delete to hooks
- `src/types/database.ts` — add edited_at, is_deleted fields
- `supabase/functions/webhook-dispatch/index.ts` — handle UPDATE events
- `docs/DB_DESIGN.md` — document new columns
- `docs/API_SPEC.md` — document PATCH/DELETE endpoints
