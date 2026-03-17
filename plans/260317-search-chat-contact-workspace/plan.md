---
title: "Search Chat & Contact Within Workspace"
description: "Client-side sidebar search filtering conversations and contacts"
status: completed
priority: P2
effort: S
tags: [sidebar, search, ux]
created: 2026-03-17
---

# Search Chat & Contact Within Workspace

## IPA Docs Reference

| Doc | Status | Key Items |
|-----|--------|-----------|
| SRD.md | Read | FR-04 (conversation list), FR-03 (online presence), S-02 (sidebar) |
| UI_SPEC.md | Read | S-02 layout, design tokens, component patterns |
| DB_DESIGN.md | Read | No DB changes needed |
| API_SPEC.md | Read | No API changes needed |

## Data Flow

```
sidebar.tsx
  useState<string>("") ── searchQuery
  useRef<HTMLInputElement> ── inputRef
  useEffect ── Cmd/Ctrl+K → inputRef.focus()
  │
  ├─► <SearchInput />  (new file: search-input.tsx)
  │     controlled input, 150ms debounce via setTimeout
  │     clear (X) button when query non-empty
  │
  ├─► <ConversationList searchQuery={debouncedQuery} ... />
  │     .filter() on conversations before DM/group split:
  │       - DM: other_user?.display_name match
  │       - Group: conv.name match
  │       - Both: last_message?.content match
  │     Empty state: "No conversations found"
  │
  └─► <AllUsers searchQuery={debouncedQuery} ... />
        .filter() on users array:
          - display_name match
        Empty state: section hidden (existing behavior when 0 users)
```

## Phase Overview

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Sidebar search with client-side filtering | Pending |

## Files Touched

| File | Change |
|------|--------|
| `src/components/sidebar/search-input.tsx` | **NEW** — search input component |
| `src/components/sidebar/sidebar.tsx` | Add search state + debounce + keyboard shortcut + render SearchInput |
| `src/components/sidebar/conversation-list.tsx` | Accept `searchQuery` prop, filter conversations |
| `src/components/sidebar/all-users.tsx` | Accept `searchQuery` prop, filter users |

## Deferred

| Item | Rationale |
|------|-----------|
| Full-text message search (Postgres tsvector + RPC + results UI) | Overkill for <50 users. Revisit when >1000 messages/conversation makes scrolling painful. |

## Review Decisions

| # | Issue | Decision |
|---|-------|----------|
| 1 | SearchInput component vs inline | New `search-input.tsx` file |
| 2 | Filter helper vs inline | Inline with optional chaining |
| 3 | Tests | Skip — manual QA checklist |
| 4 | Debounce | 150ms debounce via setTimeout (same pattern as gif-picker) |

## Manual QA Checklist

- [ ] Type partial name → conversations filter correctly
- [ ] Type partial name → users filter correctly
- [ ] Clear search (X button) → all items return
- [ ] Cmd/Ctrl+K focuses search input
- [ ] Empty conversation (no last_message) doesn't crash
- [ ] Case insensitive match works
- [ ] Pinned conversations still appear when matching search
- [ ] Archived groups section still works with search
