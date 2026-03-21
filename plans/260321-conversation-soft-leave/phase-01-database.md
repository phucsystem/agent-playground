---
phase: 1
title: "Database Migration"
status: pending
effort: 2h
---

# Phase 1: Database Migration

## Context Links
- Brainstorm: `plans/reports/brainstorm-conversation-delete-2025-03-21.md`
- Existing helpers: `supabase/migrations/006_fix_rls_recursion.sql`
- Current get_my_conversations: `supabase/migrations/021_message_management.sql` (latest version)
- Member trigger: `supabase/migrations/022_read_receipts.sql` (protect_member_columns)

## Overview
- **Priority:** High (blocks all other phases)
- **Status:** Pending
- Add `left_at` column, update helpers, create RPC, update RLS policies

## Key Insights
- `protect_member_columns` trigger (022) blocks UPDATE of everything except `last_read_at`. Must update to also allow `left_at`.
- `is_conversation_member()` used by messages INSERT policy. Left members must NOT be able to send messages. Need a new `is_active_conversation_member()` helper.
- `my_conversation_ids()` used by conversations/messages SELECT policies. Left members should still see messages (read-only). Keep returning all member rows (including left).
- `get_my_conversations()` must filter out left conversations from active list. Need separate RPC for left conversations.

## Architecture

### Column Addition
```sql
ALTER TABLE conversation_members
  ADD COLUMN left_at timestamptz DEFAULT NULL;
```

### Index
```sql
CREATE INDEX idx_conversation_members_left_at
  ON conversation_members (conversation_id, left_at)
  WHERE left_at IS NOT NULL;
```

### Helper Functions

**`is_active_conversation_member(conv_id)`** - New. Returns true only if member AND `left_at IS NULL`.

Used by: messages INSERT policy, conversation UPDATE policy.

**`is_conversation_member(conv_id)`** - Keep unchanged. Returns true for any member (active or left).

Used by: messages SELECT, conversations SELECT, attachments SELECT (read access).

### RPC Functions

**`leave_conversation(conv_id uuid)`** - Sets `left_at = now()` for current user.
- Validates user is active member
- Works for both DMs and groups

**`get_my_conversations(ws_id)`** - Update: filter out rows where `my_cm.left_at IS NOT NULL`.
- Also return `left_at` field for use by frontend.

**`get_left_conversations(ws_id uuid)`** - New RPC. Returns conversations where user has `left_at IS NOT NULL`.
- Read-only context: returns same shape as `get_my_conversations` but for left convos.

**`rejoin_conversation(conv_id, user_id)`** - Not a separate RPC. Handled by existing `members_insert` policy + clearing `left_at` via an UPDATE or by re-inserting. Decision: on invite (INSERT into conversation_members), if row exists with `left_at`, clear it instead. Use upsert logic in the invite flow or a trigger.

### RLS Policy Updates

**messages INSERT** - Change `is_conversation_member()` to `is_active_conversation_member()`:
```sql
DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND is_active_conversation_member(conversation_id)
    AND NOT EXISTS (
      SELECT 1 FROM conversations
      WHERE id = conversation_id AND is_archived = true
    )
  );
```

**conversations UPDATE** - Change to use `is_active_conversation_member`:
```sql
-- Only active members with admin role can update conversation metadata
```

### Trigger Update

Update `protect_member_columns` to allow `left_at` changes:
```sql
CREATE OR REPLACE FUNCTION protect_member_columns()
RETURNS TRIGGER AS $$
BEGIN
  NEW.role := OLD.role;
  NEW.joined_at := OLD.joined_at;
  NEW.conversation_id := OLD.conversation_id;
  NEW.user_id := OLD.user_id;
  -- left_at and last_read_at are allowed to change
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Rejoin Logic

When admin re-invites a left member, instead of INSERT (which would conflict on PK), use:
```sql
CREATE OR REPLACE FUNCTION reinvite_member(conv_id uuid, target_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Check caller is active admin of conversation
  IF NOT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = conv_id
      AND user_id = auth.uid()
      AND role = 'admin'
      AND left_at IS NULL
  ) AND NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized to invite members';
  END IF;

  -- Try to reinvite (clear left_at) or insert new
  INSERT INTO conversation_members (conversation_id, user_id, role)
  VALUES (conv_id, target_user_id, 'member')
  ON CONFLICT (conversation_id, user_id) DO UPDATE
  SET left_at = NULL, last_read_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Related Code Files

### Create
- `supabase/migrations/024_conversation_soft_leave.sql`

### Modify (downstream)
- None in this phase (SQL only)

## Implementation Steps

1. Create `024_conversation_soft_leave.sql` with:
   - [ ] Add `left_at` column to `conversation_members`
   - [ ] Add partial index on `left_at`
   - [ ] Create `is_active_conversation_member()` helper
   - [ ] Update `protect_member_columns()` trigger to allow `left_at`
   - [ ] Create `leave_conversation(conv_id)` RPC
   - [ ] Update `get_my_conversations()` to exclude left members and return `left_at`
   - [ ] Create `get_left_conversations(ws_id)` RPC
   - [ ] Create `reinvite_member(conv_id, target_user_id)` RPC
   - [ ] Update `messages_insert` policy to use `is_active_conversation_member`
   - [ ] Update `conversations_update` policy to use active member check

## Success Criteria
- Left member cannot send messages (INSERT blocked by RLS)
- Left member can still read messages (SELECT allowed)
- `get_my_conversations` excludes left conversations
- `get_left_conversations` returns only left conversations
- `leave_conversation` sets `left_at = now()`
- `reinvite_member` clears `left_at` on existing row
- Trigger allows `left_at` UPDATE

## Security Considerations
- Left members retain read access only (enforced by RLS)
- Only active admins can reinvite
- System admins can always reinvite
- `leave_conversation` only allows user to leave themselves (no spoofing)
