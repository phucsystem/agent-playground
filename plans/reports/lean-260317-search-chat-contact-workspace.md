# Lean Feature Analysis: Search Chat & Contact Within Workspace

## Current State

- **No search functionality exists** in sidebar or anywhere in the app
- SRD lists "Full-text search across messages" as **Out of Scope**
- Sidebar shows: conversation list (DMs + groups, sorted by last message), all users list (filtered by is_active only)
- Users must scroll through lists to find conversations/contacts — acceptable at <50 users, but friction grows
- Database has no full-text indexes on `messages.content`, `users.display_name`, or `conversations.name`

## Problem/Opportunity

As workspace grows (more users, more conversations), finding a specific chat or contact becomes tedious. Users must scroll through conversation list and all-users list with no filtering capability. This is a core UX gap for any chat application.

**User value:** Quickly locate conversations and contacts without scrolling. Standard expectation in chat apps (Slack, Discord, Teams all have search).

## Proposed Changes

| Change | User Value | Effort | Priority |
|--------|------------|--------|----------|
| **Search bar in sidebar** — single input filtering conversations + contacts | Instant find without scrolling | S | P1 |
| **Client-side filtering** — filter already-loaded conversations + users by name/content preview | Zero latency, no backend changes | S | P1 |
| **Keyboard shortcut** (Cmd/Ctrl+K) to focus search | Power user efficiency | S | P2 |
| **Full-text message search** — search within message content across conversations | Find specific messages by content | L | P3 (defer) |

## Recommendation: Client-Side Filtering Only (Phase 1)

**Rationale:** The app targets <50 concurrent users. All conversations and users are already loaded in sidebar state. Client-side filtering is:
- Zero backend changes (no new API, no DB indexes, no RLS updates)
- Instant results (no network latency)
- Sufficient for current scale

**Defer full-text message search** — requires Postgres `tsvector` indexes, new RPC endpoints, and a results UI. Overkill for current scale. Revisit when message volume exceeds manual scrolling comfort (>1000 messages per conversation).

## Scope Definition

### In Scope
1. Single search input at top of sidebar (below user profile, above conversation list)
2. Client-side filtering of:
   - **Conversations** — match against: other user's display_name (DMs), group name, last message preview
   - **Contacts (All Users)** — match against: display_name
3. Results update as user types (debounced 150ms)
4. Clear button (X) to reset search
5. Empty state when no results ("No results for 'xyz'")
6. Keyboard shortcut Cmd/Ctrl+K to focus search input

### Out of Scope
- Full-text message content search (across all messages)
- Server-side search / API endpoints
- Search history / recent searches
- Search results ranking / relevance scoring
- Separate search results page/modal

## Impact Analysis

- **Affected screens:** S-02 (Main Layout / Sidebar)
- **Affected components:**
  - `src/components/sidebar/sidebar.tsx` — add search input
  - `src/components/sidebar/conversation-list.tsx` — accept filter prop, filter conversations
  - `src/components/sidebar/all-users.tsx` — accept filter prop, filter users
- **Affected APIs:** None (client-side only)
- **Affected entities:** None (no DB changes)
- **New files:** None needed (add search state to existing sidebar)

## UI Concept

```
┌──────────────────────┐
│ [User Profile]       │
├──────────────────────┤
│ 🔍 Search...      ✕  │  ← NEW: search input
├──────────────────────┤
│ CONVERSATIONS        │
│ (filtered results)   │
│ ...                  │
│                      │
│ ALL USERS            │
│ (filtered results)   │
│ ...                  │
└──────────────────────┘
```

## Implementation Approach

1. Add `searchQuery` state to `Sidebar` component
2. Render search input between UserProfile and scrollable content
3. Pass `searchQuery` down to `ConversationList` and `AllUsers`
4. Filter conversations by: other_user.display_name, conv.name, last_message.content
5. Filter users by: display_name
6. Case-insensitive substring match (simple `.toLowerCase().includes()`)
7. Add `useEffect` for Cmd/Ctrl+K keyboard shortcut

## Assumptions

1. **<50 users/conversations** — client-side filtering sufficient (no need for server search)
   - Validate by: check if workspace grows beyond 100 conversations
2. **Users expect instant filtering** — not paginated search results
   - Validate by: standard chat app UX patterns
3. **No need for fuzzy matching** — exact substring match is good enough
   - Validate by: user feedback after shipping

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Performance with large lists | Low (client-side, <50 items) | If >200 items, consider virtualized list |
| Search input takes vertical space | Low | Compact design (32px height), always visible |

## Next Step

→ Run `/plan` to create implementation tasks (estimated: 1 phase, ~30 min)
