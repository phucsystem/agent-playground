# Message Edit/Delete Implementation: Compliance + UX

**Date**: 2026-03-18 14:00
**Severity**: Medium
**Component**: Messages (database, API, realtime, UI)
**Status**: Resolved

## What Happened

Shipped complete message management feature (edit + soft delete + admin audit) across 5 coordinated phases. Added `edited_at`, `is_deleted` columns, soft-delete logic, edit history tracking, RLS policies, realtime event handlers, and admin audit UI. Feature required careful coordination between database migrations, API endpoints, React Query cache invalidation, and realtime subscriptions.

## The Brutal Truth

This was less painful than expected because we resisted feature creep. The temptation to build message version history UI, bulk management, automated retention policies, and undo/recovery was strong. Instead, we shipped the MVP: edit with audit trail, soft delete with admin visibility, manual retention control. The deferred scope made implementation clean and fast. We learned to say "not in v0.3.0" and mean it.

## Technical Details

**Database changes:**
- Added `edited_at` (timestamptz) and `is_deleted` (boolean) to messages table
- Stored `edit_history[]` in metadata JSONB (lightweight, no extra table)
- RLS: sender can UPDATE own messages, conversation admin can DELETE any, global admin unrestricted
- Migration: `021_message_management.sql`

**API design:**
- PATCH `/messages/{id}` — update content + increment edit history (limited to 5)
- DELETE `/messages/{id}` — soft delete (set is_deleted=true, clear content)
- Response includes "edited" badge, "deleted" placeholder for UI

**Realtime sync:**
- Added UPDATE and DELETE event subscriptions to `use-realtime-messages` hook
- Mutation handler: `setQueryData(['messages', convId])` to update cache surgically
- Dedup logic: check message.id before applying cache update (avoids double-apply from refetch + realtime)

**UI:**
- Message context menu: edit (pre-fill in input) / delete (confirmation)
- "This message was deleted" placeholder
- "edited" badge on edited messages
- Admin audit panel shows deleted messages + edit history

**What we didn't build:**
- Version history UI (just show edited badge)
- Automated retention via cron (manual admin delete only)
- Bulk message management
- Undo recovery (admin-only restoration)

## What We Tried

1. Initial approach: version_history table — added 3 new relations, complex migrations, slow queries
   - Switched to JSONB edit_history array — simpler, faster, lightweight
2. Considered hard delete first — lost audit trail, security nightmare
   - Soft delete with admin visibility solved compliance + auditability
3. Automatic retention via pg_cron — over-engineered for MVP
   - Deferred to post-launch, manual admin delete sufficient

## Root Cause Analysis

**Feature creep is the enemy:** We had ambitious ideas (version history UI, undo, bulk ops) that sounded good but complicated the MVP. By deferring to post-launch, we shipped in one day instead of three.

**RLS complexity was manageable:** We defined clear roles (sender, conversation admin, global admin) and RLS policies mapped to them. The potential complexity didn't materialize because we thought through policy scoping upfront.

**Soft delete vs hard delete:** Hard delete is seductive (cleaner schema, simpler queries) but dangerous. Soft delete adds minimal overhead (one boolean check per query) and provides audit trail. Worth the small cost.

## Lessons Learned

1. **JSONB is your friend for audit trails:** Edit history in metadata.edit_history[] is fast, queryable, and requires zero schema changes. Beats separate tables.

2. **Deferred scope keeps MVPs lean:** "Not in v0.3.0" is a power phrase. Version history UI, automated retention, bulk management — all deferred — cut implementation time in half.

3. **RLS policies must be explicit:** Vague RLS (like "anyone in workspace") causes security bugs. Explicit roles (sender, conversation_admin, global_admin) are easier to reason about and audit.

4. **Cache invalidation still hard:** Added UPDATE subscription but initially missed DELETE events. Realtime subscriptions need explicit event type coverage.

5. **Soft delete adds one boolean:** The schema impact of soft delete is negligible. The compliance/audit benefit is massive. Always soft-delete unless you have hard requirements otherwise.

## Risk Mitigations Applied

- **Edit history bloat:** Capped at 5 edits max
- **Unread count broken:** Explicitly excluded is_deleted=true from unread queries
- **Webhook dispatch missing UPDATE:** Added manual UPDATE subscription handler (not webhook-dependent)
- **Realtime dedup:** Check msg.id before cache append

## Next Steps

- Monitor edit/delete usage in analytics (if users aren't editing, revisit UI)
- Plan post-launch: automated retention, version history UI, admin UI enhancements
- Consider message activity feeds (who edited what, when)
- Audit production data for edge cases (orphaned edit_history entries, is_deleted state inconsistencies)
