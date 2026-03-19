---
title: "Agent Discovery"
description: "Workspace-scoped agent discovery page with rich profiles, stats, categories, and hover cards"
status: complete
priority: P1
effort: 12h
branch: feat/agent-discovery
tags: [feature, frontend, database, agents]
created: 2026-03-19
completed: 2026-03-19
---

# Agent Discovery

## Overview

Add agent discovery within workspaces — rich agent profiles with metadata, a dedicated browsable/searchable page, live performance stats, category filtering, featured spotlights, hover business cards, and clickable sample prompts that open DMs.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ SCHEMA: agent_configs (extended)                             │
│  + description (text, max 1000, markdown)                    │
│  + tags (text[], max 10)                                     │
│  + category (text, enum-like)                                │
│  + sample_prompts (text[], max 5)                            │
│  + is_featured (boolean, default false)                      │
│  + composite index on webhook_delivery_logs                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│ HOOKS (React Query)                                          │
│  useAgentCatalog(workspaceId, filters)                       │
│  useAgentStats(agentIds)                                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│ UI COMPONENTS                                                │
│  /agents page → Featured + CategoryBar + Search + CardGrid   │
│  AgentCard → avatar, name, desc, tags, health, response time │
│  AgentDetailSheet → full profile + stats + sample prompts    │
│  AgentHoverCard → business card tooltip (reusable anywhere)  │
│  Admin form → extended with metadata fields                  │
│  Sidebar → "Agents" nav link                                 │
└─────────────────────────────────────────────────────────────┘
```

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Database schema + types | Complete | 2h | [phase-01](./phase-01-database-schema.md) |
| 2 | Data hooks | Complete | 2h | [phase-02-data-hooks.md](./phase-02-data-hooks.md) |
| 3 | Discovery page + components | Complete | 5h | [phase-03](./phase-03-discovery-ui.md) |
| 4 | Admin metadata + hover cards + sidebar | Complete | 3h | [phase-04](./phase-04-admin-integration.md) |

## Dependencies

- Existing: `agent_configs` table, `webhook_delivery_logs`, `use-agent-health.ts`, `Avatar` component, `react-markdown` stack
- No new npm packages needed
- No changes to Edge Function or webhook dispatch

## Key Decisions (from CEO review)

1. **Workspace-scoped** — no `public_agents` table, extend `agent_configs`
2. **Live stats** — composite index + React Query, not pre-computed
3. **Markdown descriptions** — reuse existing `react-markdown` pipeline
4. **Sidebar nav** — persistent "Agents" link for all users
5. **All 5 delights in scope** — featured spotlight, category pills, response time badge, hover cards, sample prompt quick-start
