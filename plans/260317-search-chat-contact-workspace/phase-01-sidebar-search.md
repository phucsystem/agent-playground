# Phase 1: Sidebar Search with Client-Side Filtering

**Refs:**
- Feature: docs/SRD.md#FR-04 (conversation list), S-02 (sidebar layout)
- UI: docs/UI_SPEC.md#S-02 (sidebar sections, design tokens)
- Lean: plans/reports/lean-260317-search-chat-contact-workspace.md

**Priority:** P2
**Status:** Pending
**Effort:** S (~50 lines new code across 4 files)

## Key Insights

- All conversation + user data already loaded client-side in sidebar
- No backend changes needed — pure UI filtering
- Debounce pattern already exists in `gif-picker.tsx` (setTimeout-based)
- `getDisplayName()` helper already exists in `conversation-list.tsx`

## Architecture

```
SearchInput (new)           sidebar.tsx (state owner)
┌─────────────────┐        ┌──────────────────────────┐
│ 🔍 Search...  ✕ │◄──────►│ searchQuery: string       │
│ (controlled)    │        │ debouncedQuery: string    │
│ onChange → set   │        │ debounceRef: setTimeout   │
└─────────────────┘        │ inputRef: HTMLInputElement │
                           │                          │
                           │ useEffect: Cmd/Ctrl+K    │
                           │   → inputRef.focus()     │
                           └────────┬─────────────────┘
                                    │ debouncedQuery
                          ┌─────────┴─────────┐
                          ▼                   ▼
                ConversationList          AllUsers
                .filter() inline      .filter() inline
```

## Related Code Files

**Modify:**
- `src/components/sidebar/sidebar.tsx` — add state, debounce, keyboard shortcut, render SearchInput
- `src/components/sidebar/conversation-list.tsx` — add `searchQuery` prop, filter before DM/group split
- `src/components/sidebar/all-users.tsx` — add `searchQuery` prop, filter users array

**Create:**
- `src/components/sidebar/search-input.tsx` — search input component

## Implementation Steps

### Task 1: Create SearchInput component [S]

**Refs:**
- UI: docs/UI_SPEC.md (design tokens: --neutral-100 bg, --neutral-400 placeholder, --radius-sm)

**File:** `src/components/sidebar/search-input.tsx`

**Implementation:**
- Controlled input with `value` + `onChange` props
- Search icon (lucide `Search`) left-aligned, 16px, neutral-400
- Clear button (lucide `X`) right-aligned, visible only when value non-empty
- Styling: `bg-neutral-100 rounded-lg text-sm pl-8 pr-8 py-1.5`
- Accept `inputRef` via `React.forwardRef` for keyboard shortcut focus

**Acceptance:**
- [ ] Renders search icon + input + conditional X button
- [ ] Calls onChange on every keystroke
- [ ] Calls onClear (sets value to "") when X clicked
- [ ] Accepts forwarded ref for external focus control

---

### Task 2: Add search state + debounce to sidebar.tsx [S]

**Refs:**
- Feature: docs/SRD.md#S-02

**File:** `src/components/sidebar/sidebar.tsx`

**Implementation:**
- `useState<string>("")` for `searchQuery`
- `useState<string>("")` for `debouncedQuery`
- `useRef<ReturnType<typeof setTimeout>>(null)` for debounce timer
- On `searchQuery` change: clear previous timeout, set new 150ms timeout to update `debouncedQuery`
- `useRef<HTMLInputElement>(null)` for inputRef
- `useEffect` for keyboard shortcut: `Cmd+K` (Mac) / `Ctrl+K` (others) → `inputRef.current?.focus()` + `preventDefault()`
- Render `<SearchInput>` between UserProfile and scrollable content div
- Pass `debouncedQuery` as `searchQuery` prop to `ConversationList` and `AllUsers`

**Acceptance:**
- [ ] Search input visible below user profile
- [ ] Typing updates debouncedQuery after 150ms idle
- [ ] Cmd/Ctrl+K focuses search input
- [ ] debouncedQuery passed to child components

---

### Task 3: Filter conversations by search query [S]

**Refs:**
- Feature: docs/SRD.md#FR-04

**File:** `src/components/sidebar/conversation-list.tsx`

**Implementation:**
- Add `searchQuery?: string` to `ConversationListProps`
- Filter conversations BEFORE the DM/group/archived split (line 69):
  ```
  const filtered = conversations.filter(conv => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name = conv.type === "dm"
      ? conv.other_user?.display_name
      : conv.name;
    return (
      name?.toLowerCase().includes(query) ||
      conv.last_message?.content?.toLowerCase().includes(query)
    );
  });
  ```
- Use `filtered` instead of `conversations` for DM/group/archived splits
- When filtered results are empty and searchQuery is non-empty, show "No conversations found" text

**Acceptance:**
- [ ] DMs filter by other_user.display_name
- [ ] Groups filter by conv.name
- [ ] Both filter by last_message.content
- [ ] Null fields don't crash (optional chaining)
- [ ] Case insensitive matching
- [ ] Pinned conversations still sort correctly within filtered results
- [ ] Empty state shown when no matches

---

### Task 4: Filter users by search query [S]

**Refs:**
- Feature: docs/SRD.md#FR-03

**File:** `src/components/sidebar/all-users.tsx`

**Implementation:**
- Add `searchQuery?: string` to `AllUsersProps`
- Filter `users` array after fetch + sort:
  ```
  const filteredUsers = users.filter(appUser => {
    if (!searchQuery) return true;
    return appUser.display_name.toLowerCase().includes(searchQuery.toLowerCase());
  });
  ```
- Use `filteredUsers` for rendering and count
- Existing behavior: section hidden when 0 users (no extra empty state needed)

**Acceptance:**
- [ ] Users filter by display_name
- [ ] Case insensitive matching
- [ ] Section hides when no matches (existing behavior)

## Todo List

- [ ] Task 1: Create SearchInput component
- [ ] Task 2: Add search state + debounce to sidebar.tsx
- [ ] Task 3: Filter conversations by search query
- [ ] Task 4: Filter users by search query
- [ ] Manual QA (see plan.md checklist)

## Success Criteria

- Typing in search bar instantly filters conversations and contacts
- All null/edge cases handled with optional chaining
- No backend changes, no new API calls
- Keyboard shortcut works cross-platform

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Null fields causing TypeError | Medium | Optional chaining on all nullable paths |
| Debounce feels laggy | Low | 150ms is imperceptible for filtering |
| Search input takes sidebar space | Low | Compact 32px height, always visible |

---

## After Implementation

- [ ] Run `/ipa-docs:sync` to update IPA docs
- [ ] Verify UI_SPEC.md updated with search input in S-02
