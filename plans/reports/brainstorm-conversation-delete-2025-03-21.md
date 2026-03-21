# Brainstorm: Conversation Delete (Soft-Leave + Ghost Mode)

**Date:** 2025-03-21
**Status:** Agreed — ready for implementation plan

---

## Problem Statement

Users cannot delete conversations. Only admins can hard-delete via API. Need a user-facing delete mechanism that preserves conversation history for orphan/admin recovery.

## Decisions

| Decision | Choice |
|----------|--------|
| Who deletes | Any member (soft-leave) |
| Ghost mode | All humans leave → orphaned → admins-only read-only |
| DM vs Group | Same rules for both |
| UI | Hidden from sidebar + "Deleted" section |
| Membership | Soft-leave (`left_at` timestamp preserved on `conversation_members`) |
| Orphan access | Admins only |
| Rejoin | Invite-only (another member or admin re-invites) |
| Last admin leaves | Allow orphan — workspace admin can intervene |

## Recommended Approach: `left_at` on `conversation_members`

Single column addition. Follows existing soft-delete patterns (`is_deleted`, `is_archived`). No new tables.

### Rejected Alternatives

- **Separate `conversation_deletions` table**: Over-engineered, extra joins, violates KISS
- **`status` enum on members**: YAGNI — only need active/left now

## Architecture

### Database
- Add `left_at timestamptz DEFAULT NULL` to `conversation_members`
- Orphaned = all non-agent members have `left_at IS NOT NULL`
- Index: `idx_conversation_members_left_at` on `(conversation_id, left_at)` WHERE `left_at IS NOT NULL`

### RPC Functions
- `leave_conversation(conv_id)` → sets `left_at = now()`
- Update `get_my_conversations()` → exclude `left_at IS NOT NULL`
- New `get_left_conversations(ws_id)` → left conversations for user (read-only)

### RLS Policy Updates
- Left members: SELECT messages (read-only), no INSERT
- Admins: see orphaned conversations
- Left members: no conversation metadata updates

### Realtime
- Leave → broadcast membership change → other members see updated count
- Conversation disappears from leaver's active list in real-time

### UI
- Context menu: "Delete conversation" with confirm dialog
- Sidebar: "Deleted" tab/filter
- Left conversations: read-only (input hidden, "You left this conversation" banner)
- Orphaned: admin panel or admin sidebar filter

## Edge Cases
1. Last human leaves DM → orphaned, agents remain, admin sees
2. User re-invited after leaving → clear `left_at`, restore full access
3. Last admin leaves group → orphan allowed, workspace admin intervenes
4. Messages after leave → visible on rejoin only

## Success Criteria
- Any member can leave any conversation (DM or group)
- Left conversations appear in "Deleted" section read-only
- Orphaned conversations visible to admins only
- Re-invite clears `left_at` and restores full access
- Realtime updates reflect leave/rejoin immediately
