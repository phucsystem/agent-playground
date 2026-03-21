# Code Review: Read Receipts UI

**Date:** 2026-03-19
**Branch:** feat/read-receipts-ui
**Reviewer:** code-reviewer

---

## Scope

- Files: 6 (1 migration, 3 new TS/TSX, 2 modified)
- LOC: ~150 new
- Focus: Read receipt computation, UI rendering, SQL migration

## Overall Assessment

Clean, well-structured implementation that reuses the existing `last_read_at` column and realtime subscription. The hook logic is correct for chronologically sorted messages. A few issues found, one high priority (avatar sizing), one medium (performance), and one SQL concern.

---

## Critical Issues

None.

---

## High Priority

### H1. Avatar size mismatch causes visual overflow

**File:** `src/components/chat/read-receipts.tsx` line 33

The container is `w-4 h-4` (16x16px) but `<Avatar size="sm" />` renders `w-8 h-8` (32x32px) per `avatar.tsx` line 15. The avatar will overflow or look broken.

**Fix:** Either add `overflow-hidden` to the wrapper and use CSS to scale, or create a dedicated `"xs"` size in the Avatar component:

```tsx
// Option A: Add overflow-hidden + force child sizing
<div key={reader.userId} className="w-4 h-4 rounded-full ring-1 ring-white overflow-hidden">
  <Avatar displayName={reader.displayName} avatarUrl={reader.avatarUrl} size="sm" />
</div>

// Option B (better): Add "xs" size to Avatar component
const sizeClasses = {
  xs: "w-4 h-4 text-[7px]",  // new
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
};
// Then use size="xs" in read-receipts.tsx
```

Option B is cleaner as it keeps sizing logic centralized.

---

## Medium Priority

### M1. O(members * messages) complexity in useMemo

**File:** `src/hooks/use-read-receipts.ts` lines 36-58

For each member, the hook iterates the entire messages array backwards. With M members and N messages, this is O(M*N). For typical chat (100 messages, 5 members) this is fine, but in groups with many members or after loading many pages of history, it could become noticeable.

**Optimization:** Since messages are sorted chronologically, use binary search instead of linear scan:

```ts
function findLastReadMessageIndex(messages: MessageWithSender[], readTime: number): number {
  let low = 0;
  let high = messages.length - 1;
  let result = -1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (new Date(messages[mid].created_at).getTime() <= readTime) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return result;
}
```

This makes it O(M * log N). Not urgent but good for scalability.

### M2. ReadReceipts rendered for every message even when empty

**File:** `src/components/chat/message-list.tsx` lines 235-241

The `ReadReceipts` component is rendered for every virtualized message row. Although it short-circuits with `return null` when no readers, it still creates a React element and runs the `readers.length === 0` check for every visible row. This adds overhead in the virtualizer.

**Fix:** Only render when there are actual readers:

```tsx
{readReceiptsByMessageId && readReceiptsByMessageId.has(message.id) && (
  <ReadReceipts
    readers={readReceiptsByMessageId.get(message.id)!}
    isDm={isDm}
    isCurrentUserMessage={message.sender_id === currentUserId}
  />
)}
```

### M3. SQL migration: potential duplicate publication entry

**File:** `supabase/migrations/022_read_receipts.sql` line 34

`ALTER PUBLICATION supabase_realtime ADD TABLE conversation_members` will fail if the table was already added to the publication. I checked existing migrations and it has NOT been added before, so this is safe. However, for defensive migration style, consider:

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversation_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversation_members;
  END IF;
END $$;
```

### M4. UPDATE policy lacks column restriction

**File:** `supabase/migrations/022_read_receipts.sql` lines 37-39

The policy allows users to update ANY column on their own membership row. They could potentially change their `role` or `joined_at`. Restrict to only `last_read_at`:

```sql
CREATE POLICY "members_update_own_read" ON conversation_members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Better: use a dedicated RPC function instead, or add a trigger
-- to prevent modification of role/joined_at columns.
```

Note: Postgres RLS does not support column-level restrictions in policies directly. The proper fix is either:
1. A `BEFORE UPDATE` trigger that resets protected columns to their old values
2. An RPC function that only updates `last_read_at` (which is likely what the app already does via `markAsRead`)

If `markAsRead` already uses an RPC, this policy may be unnecessary or should be tightly scoped.

---

## Low Priority

### L1. `readReceiptsByMessageId` default to `undefined` vs empty Map

The prop is optional (`readReceiptsByMessageId?: Map<...>`), so in `message-list.tsx` the guard `readReceiptsByMessageId &&` is needed. If it were always provided (defaulting to empty Map), this guard could be dropped. Minor consistency point.

### L2. Missing `"use client"` comment on purpose for read-receipts.tsx

`read-receipts.tsx` has `"use client"` but it is a pure presentational component with no hooks. It could be a server component. Not a bug, just a note since Next.js App Router would allow server rendering here if the parent passes the data.

---

## Edge Cases Found by Scout

1. **Empty conversation (no messages):** Handled -- hook returns empty Map when `messages.length === 0`.
2. **Member with null lastReadAt:** Handled -- `if (!member.lastReadAt) continue`.
3. **All members are agents:** Handled -- `otherMembers` filters agents, returns empty Map.
4. **Solo conversation (only current user):** Handled -- `otherMembers` filters current user.
5. **Messages sent at exact same timestamp as lastReadAt:** The `<=` comparison correctly includes the message.
6. **Realtime update propagation:** When another user reads messages, the `conversation_members` realtime subscription fires, `fetchMembers` re-runs, `readReceiptMembers` memo recalculates, and `useReadReceipts` recomputes. This chain is correct.
7. **Deleted (soft-deleted) messages:** These may still appear in the messages array depending on the query filter. If soft-deleted messages have `created_at` timestamps, read receipt indicators could attach to them. Verify that the messages query filters out deleted messages.

---

## Positive Observations

- Excellent decision to reuse existing `last_read_at` column rather than creating a new table
- Clean separation: hook for computation, component for rendering, migration for data
- Agent exclusion from receipts is a thoughtful UX choice
- DM vs group distinction (simple "Seen" vs avatar stack) follows industry patterns
- The `maxVisible = 4` with overflow count is standard UX

---

## Recommended Actions

1. **[HIGH]** Fix Avatar sizing mismatch -- add `xs` size variant or use overflow-hidden
2. **[MEDIUM]** Restrict UPDATE policy scope -- add trigger or use RPC-only approach
3. **[MEDIUM]** Optimize rendering -- only mount ReadReceipts when message has readers
4. **[LOW]** Consider binary search for large message lists
5. **[LOW]** Verify soft-deleted messages are excluded from the messages array

---

## Metrics

- Type Coverage: Good -- all interfaces explicitly typed
- Linting Issues: 0 new (2 pre-existing unrelated TS errors from missing changelog page)
- Test Coverage: Not assessed (no tests included in this feature)
