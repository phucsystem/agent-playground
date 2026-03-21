# Phase 05: Admin Audit

**Priority:** Medium (compliance, not blocking core UX)
**Status:** ⏳
**Effort:** S
**Depends on:** Phase 01

## Context

- Admin page at `/admin` manages users, webhooks
- Admins can already delete conversations via `/api/conversations/[id]`
- No audit log UI exists today
- Deleted messages store `original_content` in metadata JSONB
- Edited messages store `edit_history[]` in metadata JSONB

## Requirements

- Admin can view deleted/edited messages with original content
- Admin can see who deleted a message and when
- Workspace retention setting (message_retention_days) is manageable but automated cleanup is deferred

## Scope (Minimal Viable)

This phase adds **admin visibility** into edited/deleted messages. It does NOT add:
- Automated retention cleanup (future: pg_cron or scheduled Edge Function)
- Bulk message management
- Export/download of audit data
- Separate audit log table

## Related Code Files

- `src/components/chat/message-item.tsx` — admin view of deleted messages
- `src/app/chat/[conversationId]/page.tsx` — pass admin flag
- `src/components/admin/workspace-settings.tsx` — retention days setting

## Implementation Steps

### Admin Message Visibility (`message-item.tsx`)

- [ ] When `isAdmin && message.is_deleted`:
  - Show deleted placeholder + expandable "View original" section
  - Original content from `metadata.original_content`
  - Deleted by user ID from `metadata.deleted_by`
  - Deleted at from `metadata.deleted_at`
  - Style: red border or warning background to distinguish from normal messages

- [ ] When `isAdmin && message.edited_at`:
  - Add "View history" link next to "edited" badge
  - Expandable section showing `metadata.edit_history[]`
  - Each entry: previous content + timestamp

### Workspace Retention Setting (`workspace-settings.tsx`)

- [ ] Add "Message Retention" section to workspace settings
  - Dropdown or number input: retention days (7, 30, 90, 365, unlimited)
  - Save to `workspaces.message_retention_days`
  - Display note: "Messages older than X days will be automatically deleted (coming soon)"
  - Disabled/informational for now — no automated cleanup yet

### Pass Admin Flag

- [ ] In `[conversationId]/page.tsx`: derive `isAdmin` from current user role
- [ ] Pass `isAdmin` to MessageList → MessageItem

## Success Criteria

- Admins see original content of deleted messages
- Admins see edit history of edited messages
- Workspace retention days setting is saveable
- Non-admin users see only "This message was deleted" placeholder
- No automated cleanup runs (manual only for now)
