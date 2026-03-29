# Code Review: Docker Release Pipeline

## Scope
- **Files:** `Dockerfile`, `.github/workflows/ci.yml`
- **LOC changed:** ~60
- **Focus:** Docker multi-stage build, GitHub Actions CI/CD pipeline

## Overall Assessment

Solid implementation. The Dockerfile correctly places ARGs in the build stage, production stage is clean with no .env copy, and the CI workflow properly chains jobs with conditional execution. A few issues worth addressing below.

---

## Critical Issues

### 1. `.dockerignore` does not exclude `.env` (only `.env*.local`)

**File:** `.dockerignore` line 5

The pattern `.env*.local` excludes `.env.development.local` etc., but a plain `.env` file in the project root **will be copied into the Docker build context** during `COPY . .` in the build stage. If a developer has a `.env` with real secrets, those secrets enter the build layer.

**Impact:** Potential secret leakage into Docker image layers.

**Fix:** Add `.env` and `.env*` to `.dockerignore`:
```
.env
.env*
```

This is the single most important finding. The ARGs approach is correct, but it is undermined if `.env` is also copied in.

---

## High Priority

### 2. `NEXT_PUBLIC_APP_VERSION` will be stale in Docker image

**File:** `next.config.ts` line 8, `Dockerfile`

`next.config.ts` reads `packageJson.version` at build time. The Docker job checks out `ref: main`, but semantic-release has already pushed a version-bump commit by this point. The checkout **should** get the updated `package.json` with the new version — this is correct as-is because `ref: main` fetches the latest commit on main, which includes the semantic-release commit.

**Status:** No issue. Verified correct.

### 3. Version detection relies on local `package.json` diff

**File:** `ci.yml` lines 88-93

The BEFORE/AFTER comparison of `package.json` version works because `@semantic-release/npm` (with `npmPublish: false`) updates `package.json` locally, and `@semantic-release/git` commits it. However, if semantic-release fails mid-way (e.g., git push fails), `package.json` may be updated locally but not pushed — the version output would still be set, potentially triggering the docker job on a version that doesn't exist in the repo.

**Impact:** Low probability. The docker job would build from `ref: main` which wouldn't have the new version, causing a tag mismatch.

**Mitigation:** Consider checking the git push exit code or using semantic-release's own output mechanism. But pragmatically this is unlikely enough to be acceptable.

---

## Medium Priority

### 4. Missing `NEXT_PUBLIC_GIPHY_API_KEY` in CI build job

**File:** `ci.yml` lines 54-56

The `build` job only passes `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as placeholders. The Docker build passes all 4 NEXT_PUBLIC vars. If any code path requires `NEXT_PUBLIC_GIPHY_API_KEY` or `NEXT_PUBLIC_GOCLAW_URL` at build time (e.g., in a server component or getStaticProps), the CI build job could behave differently from the Docker build.

**Impact:** Inconsistency between CI validation build and actual Docker build. Likely low-risk since these vars are probably only used client-side at runtime, but worth aligning.

**Fix:** Add placeholder values for all 4 vars in the build job:
```yaml
env:
  NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder-key
  NEXT_PUBLIC_GIPHY_API_KEY: placeholder-key
  NEXT_PUBLIC_GOCLAW_URL: https://placeholder.example.com
```

### 5. Docker tag uses repository name as-is — verify case sensitivity

**File:** `ci.yml` line 131-132

`ghcr.io/${{ github.repository }}` will produce a lowercase owner but the repo name preserves case. GHCR requires all-lowercase tags. If the repository name contains uppercase characters, the push will fail.

**Fix:** Pipe through a lowercase transform:
```yaml
tags: |
  ghcr.io/${{ github.repository_owner }}/${{ github.event.repository.name }}:${{ needs.release.outputs.new_version }}
```
Or use a dedicated step to lowercase. The `docker/metadata-action` handles this automatically if you want a more robust approach.

**Note:** If the repo name is already all-lowercase, this is a non-issue. But it is a common gotcha worth guarding against.

### 6. Dokploy webhook has no version context

**File:** `ci.yml` lines 141-145

The webhook POST has no body — Dokploy doesn't know which version was just pushed. If Dokploy needs to pull a specific tag (not just `latest`), this could be insufficient.

**Impact:** Depends on Dokploy configuration. If Dokploy is configured to pull `latest`, this is fine. If it needs a specific version tag, the webhook should pass the version.

---

## Low Priority

### 7. `continue-on-error: true` on Dokploy webhook — acceptable

The `continue-on-error: true` + `|| echo` double-safety is slightly redundant but harmless. The `continue-on-error` alone is sufficient. Minor style point.

### 8. `.dockerignore` excludes `*.md` — CHANGELOG.md won't be in image

Not a functional issue since the production image doesn't need it, but worth noting.

---

## Security Assessment

| Check | Status |
|-------|--------|
| Secrets via GitHub Secrets, not hardcoded | PASS |
| GITHUB_TOKEN used for GHCR (auto-scoped) | PASS |
| `packages:write` permission scoped correctly | PASS |
| No secrets in Docker image layers | **WARN** — `.env` not in `.dockerignore` |
| Build args are NEXT_PUBLIC (client-side, non-secret) | PASS |
| Webhook URL in secrets, not exposed | PASS |
| `persist-credentials: true` only on release job | PASS |

---

## Edge Cases Analyzed

1. **No new version from semantic-release:** Docker job is skipped via `if: needs.release.outputs.new_version != ''` — correct.
2. **Webhook failure:** Both webhooks use `|| echo` fallback and/or `continue-on-error` — non-fatal, correct.
3. **PR trigger:** Release and Docker jobs gated by `github.ref == 'refs/heads/main' && github.event_name == 'push'` (release) and version output (docker) — PRs won't trigger these. Correct.
4. **Docker cache:** GHA cache (`type=gha`) is appropriate for GitHub-hosted runners. Correct.
5. **Race condition on `ref: main`:** If another commit is pushed between release and docker jobs, docker builds from latest main. Acceptable — the version tag still matches what was released.

---

## Positive Observations

- Clean multi-stage Dockerfile with proper user/group setup
- ARGs correctly placed in build stage only (not leaking to production stage)
- Job dependency chain is logical: typecheck -> build -> release -> docker
- Good use of `continue-on-error` for non-critical webhook
- GHA Docker cache for faster builds
- `fetch-depth: 0` for semantic-release (needs full history)

---

## Recommended Actions

1. **[Critical]** Add `.env` to `.dockerignore` to prevent secret leakage
2. **[Medium]** Align CI build job env vars with Docker build args (add GIPHY and GOCLAW placeholders)
3. **[Medium]** Consider lowercasing the GHCR tag to prevent case-sensitivity failures
4. **[Low]** Optionally pass version in Dokploy webhook body if needed for deployment targeting
