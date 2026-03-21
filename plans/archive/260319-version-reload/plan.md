---
title: "Force reload on new release"
description: "Detect new app versions via Supabase broadcast + polling fallback, show persistent update banner"
status: pending
priority: P2
effort: 2h
branch: feat/version-reload
tags: [devops, ux, realtime]
created: 2026-03-19
---

# Force Reload on New Release

## Overview

Notify users when a new app version is deployed so they can reload at their convenience. Uses Supabase realtime broadcast (instant) with polling fallback (5min). Never force-reloads.

## Architecture

```
CI (semantic-release) → POST /api/release-notify (secret) → Supabase broadcast("app-releases")
                                                                     ↓
Browser: useVersionCheck() subscribes → shows <UpdateBanner />
         + polls GET /api/version every 5min as fallback
```

## Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Build config + API routes + CI webhook step | pending |
| 2 | Client hook + banner component + layout integration | pending |

## Files to Create/Modify

**New files (~120 lines total):**
- `src/app/api/version/route.ts` — GET returns current version
- `src/app/api/release-notify/route.ts` — POST webhook, broadcasts via Supabase admin
- `src/hooks/use-version-check.ts` — realtime subscription + polling + version comparison
- `src/components/ui/update-banner.tsx` — persistent banner with reload button

**Modified files:**
- `next.config.ts` — add `NEXT_PUBLIC_APP_VERSION` env
- `.env.example` — add `RELEASE_WEBHOOK_SECRET`
- `.github/workflows/ci.yml` — add curl step after semantic-release
- `src/app/chat/layout.tsx` — render `<UpdateBanner />`

## Env Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_APP_VERSION` | Build-time (next.config.ts) | Embedded version from package.json |
| `RELEASE_WEBHOOK_SECRET` | Server-only (.env) | Validates CI webhook requests |

## Dependencies
None — uses existing Supabase realtime infrastructure.

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Realtime missed (sleeping tab) | Polling fallback every 5min |
| User ignores banner | Re-show on route change |
| Deploy race condition | Webhook fires after deploy completes |
