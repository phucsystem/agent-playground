---
title: "Phase 5: Agent Webhook Integration"
description: "Add decoupled webhook system for agent auto-responses via AgentInvite flow"
status: completed
priority: P1
effort: 10h
branch: main
tags: [backend, database, api, agent, webhook]
created: 2026-03-16
---

# Phase 5: Agent Webhook Integration

## Overview

Add webhook-based agent messaging. When humans send messages to conversations with agents, a Supabase Edge Function fires webhooks to each agent's configured URL. Agents respond via existing REST API. Zero changes to core chat code.

## Architecture

```
Human sends message → DB trigger (notify_webhook_dispatch)
    → pg_notify → Supabase Database Webhook → Edge Function
    → Query agent_configs for conversation members
    → POST to each active agent's webhook_url (with HMAC sig)
    → Log result to webhook_delivery_logs
    → Agent processes externally → POST /rest/v1/messages (existing)
```

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Database migration | Complete | 2h | [phase-01](./phase-01-database-migration.md) |
| 2 | Edge Function (webhook dispatch) | Complete | 3h | [phase-02](./phase-02-edge-function.md) |
| 3 | Admin UI (webhook config) | Complete | 3h | [phase-03](./phase-03-admin-ui.md) |
| 4 | Webhook logs page | Complete | 2h | [phase-04](./phase-04-webhook-logs.md) |

## Dependencies

- Phase 2 depends on Phase 1 (tables must exist)
- Phase 3 depends on Phase 1 (agent_configs table)
- Phase 4 depends on Phase 1 (webhook_delivery_logs table)
- Phases 3 and 4 can run in parallel after Phase 1

## Key References

- [SRD.md](../../docs/SRD.md) — FR-22 to FR-27
- [API_SPEC.md](../../docs/API_SPEC.md) — Webhook endpoints + payload spec
- [DB_DESIGN.md](../../docs/DB_DESIGN.md) — E-07, E-08 tables
- [UI_SPEC.md](../../docs/UI_SPEC.md) — S-06 update, S-08 new
- [Prototype: Admin](../../prototypes/s06-admin.html)
- [Prototype: Webhook Logs](../../prototypes/s08-webhook-logs.html)
