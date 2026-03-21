---
title: "Conversation Delete (Soft-Leave + Ghost Mode)"
description: "Add left_at column to conversation_members for soft-leave, deleted section in sidebar, read-only ghost mode, orphan admin visibility"
status: pending
priority: P2
effort: 6h
branch: feat/mobile-ux-enhancement
tags: [conversation, soft-delete, sidebar, rls, rpc]
created: 2026-03-21
---

# Conversation Delete (Soft-Leave + Ghost Mode)

## Summary

Any member can "delete" a conversation by soft-leaving (setting `left_at` timestamp). Left conversations move to a "Deleted" sidebar section as read-only. Orphaned conversations (all humans left) visible to admins only. Rejoin via invite clears `left_at`.

## Context

- Brainstorm: `plans/reports/brainstorm-conversation-delete-2025-03-21.md`
- Current schema: 20 migrations, `conversation_members` has no `left_at`
- Existing patterns: `is_archived` on conversations, `is_deleted` on messages
- RLS uses SECURITY DEFINER helpers (`is_conversation_member`, `my_conversation_ids`)

## Key Decisions

| Decision | Choice |
|----------|--------|
| Mechanism | `left_at timestamptz` on `conversation_members` |
| Scope | DMs + groups, same rules |
| Sidebar | Hidden from active list, shown in "Deleted" section (read-only) |
| Orphan | All humans left -> admin-only visibility |
| Rejoin | Invite clears `left_at`, restores full access |
| Last admin leaves | Allowed -> orphan, workspace admin intervenes |

## Phases

| Phase | Description | Status | Effort |
|-------|-------------|--------|--------|
| 1 - Database | Migration: column, index, RPC, RLS, helper updates | pending | 2h |
| 2 - Backend hooks | `use-leave-conversation` hook, update `use-conversations` for left filter | pending | 1.5h |
| 3 - Sidebar UI | "Deleted" section, leave action in context/info panel | pending | 1.5h |
| 4 - Chat read-only | Read-only banner for left conversations, hide input | pending | 1h |

## Files Impact Summary

### New Files
- `supabase/migrations/024_conversation_soft_leave.sql`
- `src/hooks/use-leave-conversation.ts`

### Modified Files
- `src/types/database.ts` (add `left_at` to `ConversationMember`, add `left_at` to `ConversationWithDetails`)
- `src/hooks/use-conversations.ts` (no change needed - RPC handles filtering)
- `src/components/sidebar/conversation-list.tsx` (add "Deleted" section)
- `src/components/chat/chat-info-panel.tsx` (replace hard leave with soft-leave for all convos)
- `src/app/chat/[conversationId]/page.tsx` (read-only mode for left conversations)
- `src/components/chat/chat-header.tsx` (show "left" indicator)

## Risk Assessment

- **Trigger `protect_member_columns`**: Migration 022 protects `role`, `joined_at`, `conversation_id`, `user_id` on UPDATE. Must update trigger to allow `left_at` changes.
- **`is_conversation_member` helper**: Currently returns true for any member row. Must decide: left members are still "members" for SELECT but not for INSERT. Split into `is_active_conversation_member` vs keep existing for read access.
- **Realtime**: `conversation_members` already on realtime (migration 022). UPDATE events on `left_at` will propagate.
