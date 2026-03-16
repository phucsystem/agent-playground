---
phase: 3
status: complete
priority: high
effort: medium
---

# Phase 3: Workspace Rail UI

## Context

- [Phase 2: Core Hooks](./phase-02-core-hooks-context.md) — must be complete (WorkspaceProvider available)
- [UI_SPEC.md](../../docs/UI_SPEC.md) — design system tokens

## Overview

Build Discord-style vertical icon rail on far-left of layout. Shows workspace avatars, active indicator, and admin "+" button. Clicking switches workspace context.

## Key Insights

- Current sidebar is 260px fixed on desktop — rail adds ~60px to the left
- Mobile: rail could be horizontal strip at top, or hidden behind hamburger
- Workspace avatars use DiceBear or custom URL (same pattern as user avatars)
- Active workspace has visual indicator (blue border/highlight)
- Only admin sees "+" button to create workspace

## UI Architecture

```
Desktop (lg: 1024px+):
┌──┬─────────────────┬──────────────────────┐
│WS│  Sidebar 260px   │  Chat Area           │
│60│                   │                      │
│px│                   │                      │
│  │                   │                      │
│🏠│ Conversations..   │  Messages...         │
│  │                   │                      │
│🔵│ Online Users..    │                      │
│  │                   │                      │
│+ │                   │  [Input]             │
└──┴─────────────────┴──────────────────────┘

Mobile (<1024px):
┌─────────────────────────────────────────┐
│ [☰] 🏠 🔵 🟢        Chat Header        │  ← horizontal rail in header
├─────────────────────────────────────────┤
│  Messages...                            │
└─────────────────────────────────────────┘
```

## Related Code Files

**Create:**
- `src/components/sidebar/workspace-rail.tsx` — vertical icon rail component

**Modify:**
- `src/app/chat/layout.tsx` — add rail to layout grid
- `src/app/globals.css` — rail width CSS variable (optional)

## Implementation Steps

### Step 1: Create `workspace-rail.tsx`

```typescript
// Props: workspaces, activeWorkspaceId, onSwitch, isAdmin
// Render: vertical list of workspace avatar circles
// Active: blue-500 ring / left border indicator
// Hover: tooltip with workspace name
// Admin: "+" button at bottom opens create workspace dialog
// Size: 48px workspace icons, 60px rail width
```

Key elements:
- Each workspace: circle with first letter or avatar image
- Active: `ring-2 ring-primary-500` or left blue bar
- Tooltip: workspace name on hover
- "+" button: only visible to admin role
- Separator line between workspaces and "+"

### Step 2: Update `chat/layout.tsx`

Add workspace rail to the left of sidebar:

```tsx
<div className="flex h-screen">
  {/* Workspace Rail - always visible on desktop */}
  <WorkspaceRail
    workspaces={workspaces}
    activeWorkspaceId={activeWorkspace?.id}
    onSwitch={switchWorkspace}
    isAdmin={currentUser.role === "admin"}
  />

  {/* Existing sidebar + chat area */}
  <div className="flex flex-1">
    <Sidebar ... />
    <main ...>{children}</main>
  </div>
</div>
```

### Step 3: Mobile responsive

On mobile (<lg), show workspace icons as horizontal strip:
- In chat header area or above sidebar
- Scrollable horizontal if many workspaces
- Or: add workspace selector dropdown in mobile sidebar header

### Step 4: Create workspace dialog (admin only)

Simple dialog with:
- Name input (required)
- Description textarea (optional)
- Avatar picker (optional, same DiceBear pattern as user setup)
- Create button

On submit: `supabase.from("workspaces").insert({ name, description, avatar_url, created_by })`

## Todo List

- [x] Create `src/components/sidebar/workspace-rail.tsx`
- [x] Update `src/app/chat/layout.tsx` — integrate rail
- [x] Add workspace creation dialog (admin only)
- [x] Handle mobile responsive layout
- [x] Add workspace name tooltip on hover
- [x] Style active workspace indicator
- [x] Compile check: `pnpm build` passes

## Success Criteria

- [x] Rail visible on desktop, workspace icons render
- [x] Clicking workspace switches context (conversations + presence update)
- [x] Active workspace has visual indicator
- [x] Admin sees "+" button, regular users don't
- [x] Mobile layout not broken
- [x] Workspace creation works (admin only)
