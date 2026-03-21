# Code Review: Message Management v0.3.0

**Date:** 2026-03-18
**Scope:** Edit, soft-delete, admin audit capabilities
**Files reviewed:** 7 files, ~750 LOC changed

## Overall Assessment

Solid implementation. Optimistic updates with rollback, dedup-aware realtime subscription, and RLS layering are well done. Several security and data-integrity gaps need attention before merge.

---

## Critical Issues

### C1. `edit_message` RPC allows empty/whitespace-only content

**File:** `supabase/migrations/021_message_management.sql:32-70`

The `edit_message` function has no validation on `new_content`. A user can edit a message to an empty string or whitespace, creating a "ghost" message that is not deleted but has no visible content.

**Fix:**
```sql
IF TRIM(new_content) = '' THEN
  RAISE EXCEPTION 'Message content cannot be empty';
END IF;
```

### C2. `edit_message` RPC does not check `is_deleted` before editing

A sender can edit an already-deleted message, resurrecting it with new content while `is_deleted` stays `true`. The content field gets overwritten, but the deleted state remains.

**Fix:** Add `AND is_deleted = false` to the SELECT and UPDATE WHERE clauses in `edit_message`.

### C3. `delete_message` does not guard against double-delete

Calling `delete_message` on an already-deleted message overwrites `metadata.original_content` with `''` (since content was already cleared). The original content is permanently lost from metadata.

**Fix:**
```sql
IF msg_record.is_deleted THEN
  RETURN; -- Already deleted, no-op
END IF;
```

### C4. Original content stored in metadata on delete -- information leak to non-admins

**File:** `021_message_management.sql:97-101`

The `delete_message` RPC stores `original_content` in the `metadata` column. The `messages_select` RLS policy returns the full row including `metadata` to all conversation members. Any member can read deleted message content by inspecting the `metadata` field in the API response, even though the UI only shows it to admins.

**Impact:** Privacy violation. Deleted content is readable by any conversation member via Supabase client or network tab.

**Fix options:**
1. Store original content in a separate `message_audit` table readable only by admins
2. Use a Postgres column-level security or a view that strips `metadata.original_content` for non-admin users
3. At minimum, move original content to a separate JSONB key and add a database function for admin-only retrieval

---

## High Priority

### H1. `get_my_conversations` sidebar preview shows deleted messages

**File:** `supabase/migrations/018_workspaces.sql:246-256`

The `last_message` subquery in `get_my_conversations` does not filter `is_deleted = false`. If the last message in a conversation is deleted, the sidebar will show empty content or the cleared content as the preview.

**Fix:** Add `AND last_msg.is_deleted = false` to the WHERE clause. This requires a new migration (022) to update `get_my_conversations`.

### H2. `get_my_conversations` unread count includes deleted messages

**File:** `supabase/migrations/018_workspaces.sql:257-263`

The unread count subquery does not filter `is_deleted = false`. The `get_unread_counts` RPC was updated (migration 021 line 119) but `get_my_conversations` has a duplicate unread count query that was not updated.

**Fix:** Add `AND unread_msg.is_deleted = false` to the unread count subquery in `get_my_conversations`.

### H3. Shared files panel shows files from deleted messages

**File:** `src/components/chat/chat-info-panel.tsx:80-86`

The shared files query does not filter `is_deleted`. Deleted file/image messages will still appear in the shared files panel.

**Fix:** Add `.eq("is_deleted", false)` to the query chain.

### H4. Realtime UPDATE handler loses `sender` field

**File:** `src/hooks/use-realtime-messages.ts:127-154`

The UPDATE payload from `postgres_changes` does not include the joined `sender` relation. The handler correctly preserves `msg.content/edited_at/is_deleted/metadata` from the payload but the `updated` variable (line 127) is typed as `MessageWithSender` but actually lacks `sender`. The spread on line 143-148 correctly uses `...msg` as base and only overwrites specific fields, so `sender` is preserved. However, if a future refactor replaces the message entirely with `updated`, the sender will be lost.

**Recommendation:** Add a comment or defensive check: `sender: msg.sender` in the return object to make the intent explicit.

### H5. No DELETE RLS policy -- hard delete still possible via direct API

There is no `FOR DELETE` policy on the `messages` table. If RLS has a default-deny for DELETE (Supabase default when RLS is enabled), this is fine. But verify that no existing migration adds a permissive DELETE policy. If one exists, any authenticated user could hard-delete messages, bypassing soft-delete.

**Status:** Grep confirms no DELETE policy exists. Default-deny is in effect. Low risk but worth documenting.

---

## Medium Priority

### M1. Prop drilling through 3 layers for edit/delete

`ConversationPage -> MessageList -> MessageItem` passes `onStartEdit`, `onDeleteMessage`, `canDeleteOthers`, `isAdmin`. Currently manageable at 3 levels, but if more actions are added (e.g., pin message, reply, forward), consider a MessageActions context.

### M2. `message-item.tsx` is 459 lines

The file contains 7 components (`AgentTextContent`, `MessageContent`, `HeartButton`, `MessageActions`, `EditedBadge`, `DeletedMessage`, `AdminEditHistory`, `MessageItem`). The sub-components are well-extracted but the file itself is above the 200-line guideline. Consider splitting `DeletedMessage`, `AdminEditHistory`, and `MessageActions` into their own files.

### M3. Edit history timestamp stores client `now()` vs server `now()`

In `edit_message` RPC, `edit_history` stores `now()` (server time), which is correct. But the optimistic update on the client uses `new Date().toISOString()` which may differ from server time. Minor discrepancy -- the realtime UPDATE will reconcile, but the brief flash of different timestamps could be noticeable.

### M4. Delete confirmation toast -- async callback in toast action

**File:** `src/app/chat/[conversationId]/page.tsx:91-107`

The `onClick` handler inside `toast()` action is async. If the user navigates away before the toast action completes, the component unmounts but the async operation continues. The `deleteMessage` callback captures stale closures. Low risk since the operation is fast, but error toasts may fire on unmounted components.

### M5. Edit history cap at 5 -- no user communication

The SQL caps `edit_history` at 5 entries (lines 54-60). This is reasonable for storage, but the UI shows "View history (N)" without indicating that older entries were pruned. Consider showing "View history (5 of N)" or documenting the cap.

---

## Low Priority

### L1. `formatTimestamp` could show stale "X min ago" without re-render

The timestamp display uses relative time ("just now", "5m ago") but there is no interval to trigger re-renders. A message shown as "5m ago" will stay that way until another render is triggered. Common in chat apps; acceptable.

### L2. `DeletedMessage` renders `<DeletedMessage />` without props for other user's messages

**File:** `message-item.tsx:415`

For non-current-user deleted messages, `DeletedMessage` is rendered without `message` or `isAdmin` props, so admin audit is not available for others' deleted messages. This appears intentional (admin sees audit only on own side) but may be a bug -- admins likely want to see original content regardless of who sent it.

**Fix if intentional:** Add comment. **Fix if bug:** Pass `message` and `isAdmin` to both call sites.

---

## Edge Cases Found by Scout

1. **Sidebar stale after delete:** `get_my_conversations` not filtering deleted messages means sidebar shows empty last message preview
2. **Double-delete data loss:** Second delete overwrites `original_content` in metadata with empty string
3. **Shared files leak:** Deleted file messages still visible in info panel
4. **Webhook dispatch:** If a message is deleted shortly after being sent, the webhook may have already dispatched the original content to an agent. No recall mechanism exists -- this is expected but worth noting for audit-sensitive deployments
5. **Edit while offline:** If client is offline, optimistic update shows edited content, RPC fails, rollback restores original -- but if the user has already navigated away, the rollback targets a stale query key. React Query handles this gracefully (no-op on missing key)

---

## Positive Observations

- Clean optimistic update + rollback pattern with `previousData` snapshot
- Dedup check on INSERT and skip-if-unchanged check on UPDATE in realtime handler
- Edit history with rolling cap prevents unbounded metadata growth
- `SECURITY DEFINER` on RPCs with explicit auth checks is the correct pattern
- Good separation: RPC for mutations, RLS for reads
- Delete confirmation via toast prevents accidental deletion
- Escape key to cancel edit is good UX

---

## Recommended Actions (Priority Order)

1. **[Critical]** Add empty content validation to `edit_message` RPC
2. **[Critical]** Guard `edit_message` against editing deleted messages
3. **[Critical]** Guard `delete_message` against double-delete
4. **[Critical]** Move `original_content` out of publicly-readable `metadata` column
5. **[High]** Update `get_my_conversations` to filter deleted messages in both last_message and unread_count
6. **[High]** Filter deleted messages in shared files panel query
7. **[Medium]** Pass `message` and `isAdmin` to `DeletedMessage` for non-current-user messages (if admin audit is intended there)
8. **[Medium]** Split `message-item.tsx` sub-components into separate files

---

## Metrics

- **Type Coverage:** Good -- all new types properly added to `database.ts`
- **TypeScript Compilation:** Clean (0 errors)
- **Linting Issues:** Not checked (per project rules)
- **Test Coverage:** No tests reviewed (none provided)

---

## Unresolved Questions

1. Is admin audit on other users' deleted messages intentional or a bug? (L2)
2. Should `message_retention_days` column (added to workspaces) have a scheduled cleanup job? No implementation exists yet.
3. Should webhook dispatch check `is_deleted` before sending to agents?
