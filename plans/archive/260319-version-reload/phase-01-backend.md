# Phase 1: Build Config + API Routes + CI Webhook

## Context
- [Brainstorm decisions](../reports/brainstorm-260319-version-reload.md)
- [Existing API pattern](../../src/app/api/agents/health/route.ts) — admin client pattern
- [CI workflow](../../.github/workflows/ci.yml) — release job
- [Next config](../../next.config.ts) — env injection point

## Overview
- **Priority:** P2
- **Status:** pending
- **Effort:** ~1h

## Key Insights
- Project already uses `createClient` with `SUPABASE_SERVICE_ROLE_KEY` in multiple API routes (agents/health, auth/login, auth/logout, middleware) — follow same pattern
- semantic-release bumps `package.json` version and commits it — we can read version at build time
- CI release job already has `GITHUB_TOKEN` secret; need to add `RELEASE_WEBHOOK_SECRET` and `NEXT_PUBLIC_SUPABASE_URL` + prod URL

## Implementation Steps

### 1. Inject `NEXT_PUBLIC_APP_VERSION` in next.config.ts (~5 lines)

**File:** `src/../../next.config.ts` (modify)

Read `version` from `package.json` and set as env variable:

```ts
import packageJson from "./package.json" with { type: "json" };

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  // ... existing images config
};
```

### 2. Create GET /api/version route (~10 lines)

**File:** `src/app/api/version/route.ts` (create)

Simple public endpoint returning the embedded version:

```ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown",
  });
}
```

No auth required — version is not sensitive. Useful for polling fallback.

### 3. Create POST /api/release-notify route (~35 lines)

**File:** `src/app/api/release-notify/route.ts` (create)

Validates webhook secret, broadcasts new version via Supabase realtime:

```ts
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { secret, version } = body;

  if (!secret || secret !== process.env.RELEASE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!version) {
    return NextResponse.json({ error: "Missing version" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  await supabase.channel("app-releases").send({
    type: "broadcast",
    event: "new-version",
    payload: { version },
  });

  return NextResponse.json({ ok: true, version });
}
```

### 4. Add CI webhook step in ci.yml (~10 lines)

**File:** `.github/workflows/ci.yml` (modify)

Add step after semantic-release in the `release` job. Only fires if release created a new tag (version changed):

```yaml
      - name: Release
        id: release
        env:
          GITHUB_TOKEN: ${{ secrets.SEMANTIC_RELEASE_TOKEN }}
        run: |
          pnpm exec semantic-release
          # Check if a new version was published
          NEW_VERSION=$(node -p "require('./package.json').version")
          echo "version=$NEW_VERSION" >> $GITHUB_OUTPUT

      - name: Notify app of new release
        if: steps.release.outputs.version != ''
        run: |
          curl -sf -X POST "${{ secrets.APP_URL }}/api/release-notify" \
            -H "Content-Type: application/json" \
            -d "{\"secret\":\"${{ secrets.RELEASE_WEBHOOK_SECRET }}\",\"version\":\"${{ steps.release.outputs.version }}\"}" \
            || echo "Release notification failed (non-fatal)"
```

Note: Need to detect if semantic-release actually published. The approach above reads package.json version after release runs. A more reliable approach: check if the git tag was created. But reading package.json is simpler and sufficient since semantic-release bumps it.

**Alternative detection** (more reliable): Compare version before and after:

```yaml
      - name: Release
        id: release
        env:
          GITHUB_TOKEN: ${{ secrets.SEMANTIC_RELEASE_TOKEN }}
        run: |
          BEFORE=$(node -p "require('./package.json').version")
          pnpm exec semantic-release
          AFTER=$(node -p "require('./package.json').version")
          if [ "$BEFORE" != "$AFTER" ]; then
            echo "version=$AFTER" >> $GITHUB_OUTPUT
          fi
```

Use the alternative approach — it only notifies when version actually changed.

### 5. Update .env.example (~2 lines)

**File:** `.env.example` (modify)

Add:
```
# Webhook secret for release notifications (generate a random string)
RELEASE_WEBHOOK_SECRET=
```

### 6. Add GitHub secrets

Document that these secrets need to be added to the repo:
- `RELEASE_WEBHOOK_SECRET` — random string (e.g., `openssl rand -hex 32`)
- `APP_URL` — production app URL (e.g., `https://your-app.vercel.app`)

## TODO

- [ ] Add `NEXT_PUBLIC_APP_VERSION` env injection in `next.config.ts`
- [ ] Create `src/app/api/version/route.ts`
- [ ] Create `src/app/api/release-notify/route.ts`
- [ ] Update `.github/workflows/ci.yml` release job with notify step
- [ ] Update `.env.example` with `RELEASE_WEBHOOK_SECRET`
- [ ] Verify typecheck passes (`pnpm exec tsc --noEmit`)

## Success Criteria
- `GET /api/version` returns `{ version: "x.y.z" }`
- `POST /api/release-notify` with correct secret broadcasts to `app-releases` channel
- `POST /api/release-notify` with wrong/missing secret returns 401
- CI workflow has notify step that only runs on actual version bump

## Security Considerations
- Webhook endpoint protected by shared secret (not auth — CI has no user session)
- Service role key only used server-side in API route
- Version info is not sensitive — GET endpoint is public
