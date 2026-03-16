---
title: "Agent Playground Implementation"
description: "Invite-only chat platform for sharing AI agents with testers — Supabase + Next.js"
status: pending
priority: P1
effort: 24h
branch: main
tags: [feature, fullstack, supabase, chat, realtime]
created: 2026-03-16
---

# Agent Playground Implementation

## Overview

Build invite-only chat platform where agent builders share AI agents with testers. Supports human↔human DM, human↔agent DM, group conversations. Supabase backend (Postgres + Realtime + Auth + Storage). Next.js + React + shadcn/ui + Tailwind frontend. Nuxt Chat-inspired minimal design.

## Context

- SRD: `docs/SRD.md` (18 FRs, 5 screens, 6 entities)
- UI Spec: `docs/UI_SPEC.md` (Nuxt Chat design system)
- DB Design: `docs/DB_DESIGN.md` (schema, RLS, functions)
- API Spec: `docs/API_SPEC.md` (17 endpoints + 3 realtime)
- Prototypes: `prototypes/` (5 HTML screens)

## Phases

| # | Phase | Status | Effort | Deps | Link |
|---|-------|--------|--------|------|------|
| 1 | Setup + Database | Pending | 4h | — | [phase-01](./phase-01-setup-database.md) |
| 2 | Auth + Core Chat | Pending | 8h | P1 | [phase-02](./phase-02-auth-core-chat.md) |
| 3 | Rich Content + Groups | Pending | 8h | P2 | [phase-03](./phase-03-rich-content-groups.md) |
| 4 | Polish | Pending | 4h | P3 | [phase-04](./phase-04-polish.md) |

## Execution Order

```
P1 (Setup+DB) → P2 (Auth+Chat) → P3 (Rich+Groups) → P4 (Polish)
```

All sequential. Each phase builds on previous.

## Key Dependencies

- Supabase project (free tier)
- Node.js 20+, pnpm
- shadcn/ui, tailwindcss, react-markdown, remark-gfm, rehype-highlight
