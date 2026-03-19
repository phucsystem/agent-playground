# Phase 3: Discovery Page + Components

## Context

- [Phase 2: Data Hooks](./phase-02-data-hooks.md)
- [Avatar component](../../src/components/ui/avatar.tsx) — reuse bot badge + health dot
- [Markdown content](../../src/components/chat/markdown-content.tsx) — reuse for descriptions
- [All Users](../../src/components/sidebar/all-users.tsx) — DM start pattern
- [UI_SPEC](../../docs/UI_SPEC.md) — design system tokens

## Overview

- **Priority:** P1
- **Status:** Complete
- **Effort:** 5h
- **Blocked by:** Phase 2

Build the agent discovery page at `/chat/agents` with featured spotlight, category filter bar, search, agent card grid, and agent detail sheet.

## Key Design Decisions

- **Route:** `/chat/agents` (inside chat layout, keeps sidebar visible)
- **Detail view:** Sheet/drawer (not full page) — user stays on discovery page
- **Card grid:** CSS grid, responsive (1 col mobile, 2 tablet, 3 desktop)
- **Category bar:** Horizontal scrollable pill bar with icons
- **Featured:** Top section with larger hero cards (max 3)

## Architecture

```
/chat/agents (page.tsx)
├── FeaturedAgentsSection
│   └── AgentCard (variant="featured", larger)
├── CategoryFilterBar
│   └── CategoryPill × 8 (with Lucide icons)
├── SearchInput (reuse pattern from sidebar)
├── AgentCardGrid
│   └── AgentCard × N (variant="default")
└── AgentDetailSheet (slide-over drawer)
    ├── Avatar + Health + Name
    ├── Description (markdown)
    ├── Tags
    ├── Stats (response time, uptime, messages)
    ├── SamplePrompts (clickable → start DM with pre-fill)
    └── "Message Agent" button
```

**Category icons mapping:**

| Category | Lucide Icon |
|----------|-------------|
| writing | `Pen` |
| code | `Code` |
| research | `Search` |
| data | `Database` |
| support | `Headphones` |
| creative | `Palette` |
| ops | `Settings` |
| general | `Bot` |

## Related Code Files

### Create
- `src/app/chat/agents/page.tsx` — discovery page
- `src/components/agents/agent-card.tsx` — card component
- `src/components/agents/agent-detail-sheet.tsx` — detail drawer
- `src/components/agents/category-filter-bar.tsx` — category pills
- `src/components/agents/featured-agents.tsx` — featured section
- `src/components/agents/agent-stats-display.tsx` — stats badges

### Modify
- None in this phase (sidebar link in Phase 4)

## Implementation Steps

### 1. Create page at `src/app/chat/agents/page.tsx`

- Client component (needs hooks)
- Use `useAgentCatalog` + `useAgentStats` + `useAgentHealth` context
- State: `selectedCategory`, `searchQuery`, `selectedAgent` (for sheet)
- Layout: Featured → CategoryBar → Search → Grid
- Empty state: "No agents in this workspace" with admin CTA

### 2. Create `agent-card.tsx`

```
┌─────────────────────────────────┐
│ [Avatar]  Agent Name        ●   │  ← health dot
│           @category             │
│                                 │
│ Short description text that     │
│ truncates at 2 lines...         │
│                                 │
│ [tag1] [tag2] [+3]             │
│                                 │
│ ⚡ <2s    ✓ 98%    📨 142      │  ← stats row
└─────────────────────────────────┘
```

Props:
- `agent: AgentCatalogEntry`
- `stats?: AgentStats`
- `healthStatus?: AgentHealthStatus`
- `variant: 'default' | 'featured'`
- `onClick: () => void`

Featured variant: wider card, gradient border using workspace accent color, full description (no truncate)

### 3. Create `agent-detail-sheet.tsx`

Slide-over drawer (right side, similar to `chat-info-panel.tsx` pattern):
- Full avatar (large) + health status badge
- Agent name + category with icon
- Markdown description (use `MarkdownContent` component)
- Tags as pills
- Stats section: response time, uptime %, total messages
- Sample prompts section: clickable cards
  - Click → `router.push('/chat/${dmId}?prompt=${encodeURIComponent(prompt)}')`
  - Use `find_or_create_dm` RPC to get/create DM
- "Message this Agent" CTA button

### 4. Create `category-filter-bar.tsx`

Horizontal scrollable bar with pills:
- "All" pill (default active, no filter)
- One pill per category with Lucide icon + label
- Active state: filled bg, bold text
- Scroll overflow with fade gradient on edges

### 5. Create `featured-agents.tsx`

- Filter catalog for `is_featured === true`
- Show max 3 in a highlighted section
- If no featured agents → hide section entirely
- Cards use `variant="featured"` (larger, gradient border)

### 6. Create `agent-stats-display.tsx`

Reusable stats row for both card and detail sheet:
- Response time: `⚡ <Xs` (format ms to human-readable)
- Uptime: `✓ XX%`
- Messages handled: `📨 N`
- Null stats → show "—" for each

### 7. Handle "Try it" / sample prompt flow

When user clicks a sample prompt in detail sheet:
1. Call `find_or_create_dm(agent.user_id, activeWorkspace.id)`
2. Navigate to `/chat/${conversationId}`
3. Pre-fill chat input with the sample prompt text
4. Pre-fill approach: URL query param `?prompt=...` read by `chat-input.tsx`

### 8. Empty & loading states

- Loading: skeleton grid (reuse skeleton patterns)
- Empty (no agents): centered illustration + text + "Ask admin to add agents"
- No matches (search/filter): "No agents match your search"

## Todo List

- [x] Create `/chat/agents/page.tsx` with layout and state
- [x] Create `agent-card.tsx` with default + featured variants
- [x] Create `agent-detail-sheet.tsx` with full profile
- [x] Create `category-filter-bar.tsx` with icons
- [x] Create `featured-agents.tsx` section
- [x] Create `agent-stats-display.tsx` reusable component
- [x] Implement sample prompt → DM pre-fill flow
- [x] Add empty and loading states
- [x] Mobile responsive layout (1/2/3 column grid)
- [x] Verify markdown rendering in descriptions

## Success Criteria

- Discovery page renders at `/chat/agents`
- Featured agents appear at top when `is_featured=true`
- Category filter narrows results
- Search filters by name and description
- Agent detail sheet opens with full profile
- Sample prompts open DM with pre-filled text
- Stats display response time, uptime, message count
- Mobile responsive (1-col on phone, 2 on tablet, 3 on desktop)
- Empty states render correctly

## Risk Assessment

- **Pre-fill chat input via URL param** — needs small change in `chat-input.tsx` to read `?prompt=` param. Low risk, contained change.
- **Sheet z-index conflicts** — check against existing sheets (chat-info-panel). Use same z-index strategy.

## Security Considerations

- Markdown descriptions rendered via `react-markdown` (XSS-safe by default)
- No `webhook_secret` in catalog data (excluded in query)
- Agent detail sheet: no admin-only data exposed to regular users
