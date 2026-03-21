# Brainstorm: Docker Release Pipeline for Dokploy

**Date:** 2026-03-21
**Status:** Agreed

---

## Problem Statement

Current CI pipeline (typecheck → build → semantic-release) produces version tags and changelogs but no deployable artifact. Deployment requires manual Docker build or Vercel. Goal: automated Docker image build + push to registry + auto-deploy to Dokploy on every release.

---

## Evaluated Approaches

### Option A: Docker job in existing CI workflow (Chosen)
Add a `docker` job after `release` in `ci.yml` that builds and pushes to GHCR.

**Pros:** Single workflow file, release version available as job output, no extra trigger complexity
**Cons:** Longer CI run on main (sequential jobs)

### Option B: Separate workflow triggered by tag push
New `docker.yml` triggered on `v*` tag push events.

**Pros:** Clean separation, CI stays fast, can be rerun independently
**Cons:** Tag push race condition with semantic-release git push, harder to pass version info

### Option C: GitHub Actions reusable workflow
Reusable workflow called from release step.

**Pros:** DRY if multiple repos need same pattern
**Cons:** Over-engineered for single repo (YAGNI)

---

## Final Solution

### Architecture

```
Push to main
  → [typecheck] → [build] → [release]
                                ↓ (outputs: new_version)
                           [docker] (only if new_version exists)
                                ↓
                           Build multi-stage Dockerfile
                           Push to ghcr.io/<owner>/agent-playground:1.15.0 + :latest
                                ↓
                           POST webhook → Dokploy auto-redeploy
```

### Implementation Details

#### 1. CI Workflow Changes (`.github/workflows/ci.yml`)

New `docker` job:
- **Depends on:** `release` job
- **Condition:** `needs.release.outputs.new_version != ''`
- **Steps:**
  1. Checkout code
  2. Set up Docker Buildx
  3. Login to GHCR (`docker/login-action` with `GITHUB_TOKEN`)
  4. Build & push (`docker/build-push-action`)
     - Tags: `ghcr.io/<owner>/agent-playground:<version>`, `ghcr.io/<owner>/agent-playground:latest`
     - Build args: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from GitHub secrets)
     - Cache: GitHub Actions cache for layer reuse
  5. Notify Dokploy via webhook POST

#### 2. Dockerfile Changes
None. Current multi-stage Dockerfile is production-ready.

#### 3. Build-time Secrets
`NEXT_PUBLIC_*` vars must be available at build time (Next.js bakes them into client bundle):
- `NEXT_PUBLIC_SUPABASE_URL` → GitHub secret
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → GitHub secret
- `NEXT_PUBLIC_GIPHY_API_KEY` → GitHub secret (optional)
- `NEXT_PUBLIC_APP_VERSION` → Set from release version output

#### 4. Dokploy Configuration
- Image source: `ghcr.io/<owner>/agent-playground:latest` (or pin specific version)
- Runtime env vars configured in Dokploy UI (Supabase keys, admin token, etc.)
- Webhook endpoint for auto-redeploy on image push

#### 5. Image Tagging Strategy

| Tag | Example | Purpose |
|-----|---------|---------|
| Semver | `1.15.0` | Immutable, rollback-friendly |
| `latest` | Always newest | Dokploy default pull target |

#### 6. GitHub Repo Settings
- Enable GHCR: automatic with `packages: write` permission on workflow
- Add secrets: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DOKPLOY_WEBHOOK_URL`, `DOKPLOY_WEBHOOK_SECRET`

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Build-time secrets leaked in image layers | Use `--build-arg` (not `--secret`) — these are public `NEXT_PUBLIC_*` vars, safe to bake in |
| Dokploy webhook fails | Non-fatal step (continue-on-error), same pattern as existing release-notify |
| Large image size | Current ~200MB Alpine is acceptable; monitor with `docker images` |
| GHCR rate limits | Free tier generous for private repos; public repos unlimited |
| Rollback needed | Pull previous semver tag in Dokploy (`ghcr.io/.../agent-playground:1.14.0`) |

---

## Success Criteria

- [ ] `git push` to main with conventional commit triggers full pipeline
- [ ] Semantic-release creates version → Docker image built and pushed to GHCR
- [ ] Image tagged with semver + latest
- [ ] Dokploy receives webhook and auto-redeploys
- [ ] No manual steps between merge and deployment
- [ ] Rollback possible by changing Dokploy image tag to previous version

---

## Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Build-time: Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Build-time: Supabase anon key |
| `DOKPLOY_WEBHOOK_URL` | Dokploy deploy webhook endpoint |

---

## Next Steps

1. Update `.github/workflows/ci.yml` — add docker job
2. Update Dockerfile if needed for build args (add ARG declarations for NEXT_PUBLIC vars)
3. Add GitHub secrets for build-time env vars and Dokploy webhook
4. Configure Dokploy app to pull from GHCR
5. Test end-to-end with a patch commit
