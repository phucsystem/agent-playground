# Phase 1: Fix Dockerfile for CI Builds

## Priority: High
## Status: ⏳

## Problem

Two issues prevent CI Docker builds:

1. **Line 26:** `COPY --from=build /app/.env ./.env` fails when no `.env` file exists (CI has no `.env`)
2. **No ARG declarations:** `NEXT_PUBLIC_*` vars aren't available at build time — Next.js can't bake them into the client bundle

## Related Files

- `Dockerfile` (modify)

## Implementation Steps

### 1. Add ARG declarations to build stage

Add `ARG` for each `NEXT_PUBLIC_*` env var before `RUN pnpm build`. These become environment variables during build via `docker build --build-arg`.

```dockerfile
# ---- Build ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# Build-time args for Next.js public env vars
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_GIPHY_API_KEY
ARG NEXT_PUBLIC_GOCLAW_URL

RUN pnpm build
```

### 2. Remove `.env` COPY from production stage

Line 26 (`COPY --from=build /app/.env ./.env`) must be removed. Runtime env vars are injected by Dokploy (or docker-compose `env_file`), not baked into the image.

**Before:**
```dockerfile
COPY --from=build /app/.env ./.env
COPY --from=build /app/public ./public
```

**After:**
```dockerfile
COPY --from=build /app/public ./public
```

## Todo

- [ ] Add ARG declarations for NEXT_PUBLIC_* vars in build stage
- [ ] Remove `.env` COPY from production stage
- [ ] Verify local `docker compose --profile prod up` still works (env_file injects at runtime)

## Risk

- Removing `.env` COPY means standalone Docker runs MUST provide env vars externally (docker-compose env_file, Dokploy env config, or `-e` flags). This is correct behavior — secrets should never be baked into images.
