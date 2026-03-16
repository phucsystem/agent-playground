---
status: complete
created: 2026-03-17
slug: multi-workspace-support
phases: 5
estimated_files: 20
---

# Multi-Workspace Support

**Brainstorm:** `plans/reports/brainstorm-260317-multi-workspace-support.md`

## Summary

Add workspace isolation to Agent Playground. Users belong to multiple workspaces, see only workspace-scoped users/conversations/presence. Global admin manages all workspaces. Agents remain global. Discord-style icon rail for switching.

## Key Decisions

| Decision | Choice |
|----------|--------|
| Data model | `workspace_id` FK on conversations |
| Membership | `workspace_members` join table |
| Admin | Global admin only (no workspace-level admin) |
| Agents | Global, not workspace-scoped |
| DMs | Separate per workspace |
| Presence | Per-workspace channels |
| UI | Discord-style icon rail (far-left vertical strip) |
| State | localStorage `active_workspace_id` |
| Migration | Auto-migrate to "Default" workspace |

## Phases

| # | Phase | Status | Priority | Effort |
|---|-------|--------|----------|--------|
| 1 | [Database & Migration](./phase-01-database-migration.md) | complete | critical | high |
| 2 | [Core Hooks & Context](./phase-02-core-hooks-context.md) | complete | critical | medium |
| 3 | [Workspace Rail UI](./phase-03-workspace-rail-ui.md) | complete | high | medium |
| 4 | [Component Updates](./phase-04-component-updates.md) | complete | high | medium |
| 5 | [Admin Workspace Management](./phase-05-admin-workspace-management.md) | complete | medium | medium |

## Dependencies

```
Phase 1 (DB) → Phase 2 (Hooks) → Phase 3 (Rail UI)
                                → Phase 4 (Components)
                                → Phase 5 (Admin)
```

Phase 3, 4, 5 can run in parallel after Phase 2.

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| RLS policy complexity | Medium | Follow existing DEFINER pattern |
| Migration data integrity | Medium | Run in transaction, verify backfill |
| Realtime channel per workspace | Low | One presence channel per workspace |
| Breaking existing DMs | High | Careful backfill + test with seed data |
