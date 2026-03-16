# Phase 5: Chat UI (Status Dot + Toast)

**Priority:** Medium
**Status:** completed
**Effort:** M (Medium)
**Depends on:** Phase 3

## Overview

Show agent health status in chat UI:
1. **Status dot on avatar** — green (healthy), red (unhealthy), gray (unknown/no health URL)
2. **Toast notification** — fires when agent transitions between healthy↔unhealthy

## Related Files

**Modify:**
- `src/components/ui/avatar.tsx` — add `healthStatus` prop
- `src/components/sidebar/conversation-list.tsx` — pass health status to DM agent avatars
- `src/components/sidebar/sidebar.tsx` — accept + pass health status
- `src/app/chat/layout.tsx` — initialize `useAgentHealth()`, pass down

**Reference (pattern to follow):**
- `src/components/ui/presence-toast.tsx` — existing toast pattern
- `src/hooks/use-supabase-presence.ts` — existing presence hook pattern

## Implementation Steps

### 1. Update Avatar Component

Add optional `healthStatus` prop to `Avatar`:

```typescript
healthStatus?: "healthy" | "unhealthy" | "unknown";
```

Rendering logic (prioritized):
- If `healthStatus` is set → show health dot (takes precedence over presence dot for agents)
  - `healthy` → green dot (same `bg-success` as online)
  - `unhealthy` → red dot (`bg-error`)
  - `unknown` → gray dot (`bg-neutral-400`)
- Existing `showPresence` + `isOnline` behavior unchanged for non-agents

The health dot replaces the bot badge position for agents when health status is known. Use the same sizing/positioning as presence dot.

### 2. Wire Health Status in Sidebar

In `sidebar.tsx`:
- Accept `agentHealthMap` (or `getAgentHealthStatus`) prop
- Pass to `ConversationList`

In `conversation-list.tsx`:
- For DM conversations where `other_user.is_agent === true`:
  - Pass `healthStatus={getAgentHealthStatus(other_user.id)}` to `Avatar`

### 3. Initialize in Chat Layout

In `chat/layout.tsx`:
- Call `useAgentHealth()` hook
- Pass `getStatus` function down through Sidebar props

### 4. Toast on Transitions

In `chat/layout.tsx` (alongside existing presence toast logic):
- Watch `transitions` from `useAgentHealth()`
- For each transition, show toast:
  - `healthy` → "🟢 {Agent Name} is now available"
  - `unhealthy` → "🔴 {Agent Name} is unavailable"
- Call `clearTransitions()` after processing
- Need agent display names: cross-reference with conversations or user list

### 5. Status Dot Styling

```
Agent Avatar with health status:
┌─────┐
│     │  (avatar image/initials)
│     │
└──●──┘  ← health dot (bottom-right)

Colors:
● green  (#00c950) = healthy
● red    (#fb2c36) = unhealthy
● gray   (#9f9fa9) = unknown
```

## Todo

- [x] Add `healthStatus` prop to Avatar component
- [x] Render health dot for agents (replace bot badge when health known)
- [x] Update Sidebar props to accept health status
- [x] Update ConversationList to pass health to DM agent avatars
- [x] Initialize `useAgentHealth()` in chat/layout.tsx
- [x] Wire toast notifications for transitions
- [x] Compile check

## Success Criteria

- [x] Agent DM avatars show colored health dot in sidebar
- [x] Green dot for healthy agents, red for unhealthy, gray for unknown
- [x] Toast fires when agent status changes (not on initial load)
- [x] Non-agent users unaffected (presence dot unchanged)
- [x] No health URL configured → gray dot (unknown, not red)

## Risk

- **Agent display names for toast:** Need user list to map agentId → display_name. Can use `onlineUsers` or fetch from conversations list.
- **Avatar complexity:** Adding health dot alongside bot badge and presence dot. Keep rendering logic clear with priority: healthStatus (agents) > showPresence (humans).
