# Phase 4: Admin Metadata + Hover Cards + Sidebar

## Context

- [Phase 3: Discovery UI](./phase-03-discovery-ui.md)
- [Admin page](../../src/app/admin/page.tsx) — agent creation form
- [Webhook config form](../../src/components/admin/webhook-config-form.tsx) — existing form pattern
- [Sidebar](../../src/components/sidebar/sidebar.tsx) — nav structure
- [Avatar](../../src/components/ui/avatar.tsx) — hover target

## Overview

- **Priority:** P1
- **Status:** Complete
- **Effort:** 3h
- **Blocked by:** Phase 3

Three integration tasks: (1) extend admin form with agent metadata fields, (2) add agent hover business card, (3) add sidebar "Agents" nav link.

## Related Code Files

### Create
- `src/components/agents/agent-hover-card.tsx` — hover business card tooltip

### Modify
- `src/app/admin/page.tsx` — add metadata fields to agent creation
- `src/components/admin/webhook-config-form.tsx` — add metadata section
- `src/hooks/use-agent-configs.ts` — include metadata in CRUD operations
- `src/components/sidebar/sidebar.tsx` — add "Agents" nav link
- `src/components/chat/chat-input.tsx` — read `?prompt=` URL param for pre-fill

## Implementation Steps

### 1. Extend admin agent creation form

In `admin/page.tsx`, when creating an agent (isAgent toggle is on), add fields after webhook config:

```
Agent Metadata (optional)
├── Description (textarea, placeholder: "What does this agent do?")
├── Category (select dropdown: writing, code, research, etc.)
├── Tags (comma-separated input → array)
├── Sample Prompts (multi-line input, one per line, max 5)
└── Featured (checkbox: "Show in featured spotlight")
```

Pass metadata to `createConfig()`.

### 2. Extend webhook-config-form for editing metadata

Add "Agent Profile" section to `webhook-config-form.tsx` below webhook fields:
- Same fields as creation form
- Pre-populated with existing values
- Save updates via `updateConfig()`

### 3. Update `use-agent-configs.ts`

- `createConfig()` — accept metadata params (description, tags, category, sample_prompts, is_featured)
- `updateConfig()` — accept metadata in updates object
- `fetchConfigs()` — include new columns in SELECT (but still exclude `webhook_secret` where appropriate)
- Update `AgentConfig` type import

### 4. Create `agent-hover-card.tsx`

Hover tooltip that appears on any agent avatar in the app:
- Triggered on hover over `Avatar` component when `isAgent=true`
- Shows: avatar (lg), name, category with icon, description (truncated 100 chars), health status, response time badge
- Position: auto (above/below based on viewport)
- Delay: 300ms enter, 100ms leave (prevent flicker)
- Use Radix UI `HoverCard` or simple CSS tooltip

```
┌──────────────────────────────┐
│ [Avatar]  Claude Agent       │
│           code · ● Online    │
│                              │
│ I help with code review and  │
│ debugging tasks...           │
│                              │
│ ⚡ <1s response time         │
└──────────────────────────────┘
```

Integration points — wrap `Avatar` in hover card when:
- `all-users.tsx` user list
- `message-item.tsx` sender avatar
- `mention-picker.tsx` mention candidates
- `chat-header.tsx` DM partner avatar

**Approach:** Create a wrapper `AgentAvatarWithHover` that conditionally wraps `Avatar` in hover card when `isAgent=true` and agent catalog data is available.

### 5. Add sidebar "Agents" nav link

In `sidebar.tsx`, add between conversation list and footer:

```tsx
<Link
  href="/chat/agents"
  className="flex items-center gap-2 px-3 py-2 mx-2 text-sm text-neutral-500 rounded-lg hover:bg-neutral-100 transition"
>
  <Bot className="w-4 h-4" />
  Discover Agents
</Link>
```

Visible to all users (not admin-only). Place above footer buttons.

### 6. Chat input pre-fill from URL param

In `chat-input.tsx` (or the conversation page), read `?prompt=` query parameter:
- On mount, if `prompt` param exists:
  - Set input value to decoded prompt text
  - Focus the input
  - Clear the URL param (replace state, no history entry)
- This enables the sample prompt → DM → pre-filled message flow

## Todo List

- [x] Add metadata fields to admin agent creation form
- [x] Add metadata section to webhook-config-form
- [x] Update `use-agent-configs.ts` CRUD for metadata
- [x] Create `agent-hover-card.tsx` component
- [x] Create `AgentAvatarWithHover` wrapper
- [x] Integrate hover card in sidebar, messages, mentions, header
- [x] Add "Discover Agents" link in sidebar
- [x] Add `?prompt=` pre-fill in chat-input
- [x] Verify hover card positioning on mobile (skip hover on touch)

## Success Criteria

- Admin can set description, tags, category, sample prompts, featured flag when creating/editing agents
- Hovering over agent avatars shows business card tooltip
- Sidebar shows "Discover Agents" link for all users
- Sample prompts pre-fill chat input when navigating from discovery
- Hover card doesn't show on mobile (touch devices)

## Risk Assessment

- **Hover card integration breadth** — touches 4 components, but change is additive (wrap existing Avatar). Low risk.
- **Chat input pre-fill** — URL param approach is clean, no state management complexity
- **Admin form size** — adding 5 fields may make form long. Consider collapsible "Agent Profile" section.

## Security Considerations

- Admin-only access to metadata editing (existing RLS)
- Hover card only shows public metadata (no secrets)
- URL param `?prompt=` — user-supplied text going into input (not executed, just displayed). Safe.

## Next Steps

After all phases complete:
- Update `docs/DB_DESIGN.md` with new columns
- Update `docs/API_SPEC.md` with catalog query patterns
- Update `docs/UI_SPEC.md` with discovery page screen
- Update `docs/project-roadmap.md` — mark agent discovery shipped
- Update `docs/codebase-summary.md` with new files
