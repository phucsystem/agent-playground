# Brainstorm: Force Reload on New Release

**Date:** 2026-03-19
**Status:** Agreed — ready for implementation

## Problem
Users stay on stale app versions after deployment. Need instant detection + non-disruptive reload prompt.

## Decisions

| Decision | Choice |
|----------|--------|
| Detection | Supabase realtime broadcast + polling fallback (5min) |
| UX | Persistent banner, user-controlled reload |
| Force reload | Never — purely advisory |
| Trigger | CI webhook → API route → Supabase broadcast |

## Architecture

```
CI (semantic-release) → POST /api/release-notify → Supabase broadcast("app-releases")
                                                          ↓
Browser: useVersionCheck() subscribes → shows <UpdateBanner />
         + polls /api/version every 5min as fallback
```

## Implementation Scope (~120 lines, 5 files)

1. **API route** `/api/release-notify` — POST, validates webhook secret, broadcasts via Supabase admin
2. **API route** `/api/version` — GET, returns current `APP_VERSION`
3. **CI step** — curl POST in ci.yml after semantic-release succeeds
4. **Client hook** `useVersionCheck()` — realtime subscribe + polling + version comparison
5. **Banner component** `<UpdateBanner />` — persistent, dismissable, reappears on navigation
6. **Build config** — `NEXT_PUBLIC_APP_VERSION` from package.json in next.config.ts

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Realtime missed (sleeping tab) | Polling fallback every 5min |
| User ignores banner | Re-show on route change |
| Deploy race condition | Webhook fires after deploy, not before |
| Multiple tabs | Each tab independent — fine |

## No New Dependencies
Leverages existing Supabase realtime infrastructure.
