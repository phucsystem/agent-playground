# Phase 3: Manual Configuration (GitHub + Dokploy)

## Priority: High
## Status: ⏳

## No code changes — manual setup steps only.

### 1. GitHub Secrets

Add these secrets in **repo → Settings → Secrets and variables → Actions**:

| Secret | Value | Purpose |
|--------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Build-time: baked into client JS |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key | Build-time: baked into client JS |
| `NEXT_PUBLIC_GIPHY_API_KEY` | GIPHY API key | Build-time: optional |
| `NEXT_PUBLIC_GOCLAW_URL` | GoClaw server URL | Build-time: optional |
| `DOKPLOY_WEBHOOK_URL` | Dokploy deploy webhook URL | Trigger auto-redeploy |

> `SEMANTIC_RELEASE_TOKEN`, `APP_URL`, `RELEASE_WEBHOOK_SECRET` already exist.

### 2. Dokploy Application Setup

1. Create new application in Dokploy
2. Set source to **Docker Image**: `ghcr.io/<owner>/agent-playground:latest`
3. Add **runtime env vars** (these are NOT build-time — injected at container start):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_INITIAL_TOKEN`
   - `RELEASE_WEBHOOK_SECRET`
   - `GOCLAW_URL`
   - `GOCLAW_GATEWAY_TOKEN`
   - `NEXT_PUBLIC_GIPHY_API_KEY`
   - `NEXT_PUBLIC_GOCLAW_URL`
4. Set port to `3000`
5. Configure domain/SSL as needed
6. Copy the **Deploy Webhook URL** from Dokploy → paste as `DOKPLOY_WEBHOOK_URL` GitHub secret

### 3. GHCR Package Visibility

After first image push:
- Go to GitHub → Packages → `agent-playground`
- Set visibility to match repo (private or public)
- If private: Dokploy server needs GHCR auth (personal access token with `read:packages`)

### 4. Test End-to-End

```bash
# Create a patch commit to trigger pipeline
git commit --allow-empty -m "fix: trigger docker pipeline test"
git push origin main
```

Verify:
- [ ] CI passes: typecheck → build → release → docker
- [ ] Image appears in GitHub Packages
- [ ] Dokploy receives webhook and redeploys
- [ ] App is accessible on Dokploy domain

## Todo

- [ ] Add GitHub secrets (NEXT_PUBLIC_*, DOKPLOY_WEBHOOK_URL)
- [ ] Create Dokploy application with GHCR image source
- [ ] Configure Dokploy runtime env vars
- [ ] Set GHCR package visibility
- [ ] Test full pipeline end-to-end
