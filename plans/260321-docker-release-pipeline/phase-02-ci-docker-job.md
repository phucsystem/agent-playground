# Phase 2: Add Docker Job to CI Workflow

## Priority: High
## Status: ⏳

## Related Files

- `.github/workflows/ci.yml` (modify)

## Implementation Steps

### 1. Add `outputs` to release job

The release job already sets `version` in `$GITHUB_OUTPUT`. Expose it as a job output:

```yaml
release:
  name: Release
  needs: build
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  runs-on: ubuntu-latest
  outputs:
    new_version: ${{ steps.release.outputs.version }}
  steps:
    # ... existing steps unchanged
```

### 2. Add `packages: write` permission

Required for GHCR push. Add to top-level permissions:

```yaml
permissions:
  contents: write
  issues: write
  pull-requests: write
  packages: write
```

### 3. Add `docker` job

New job after `release`:

```yaml
docker:
  name: Docker
  needs: release
  if: needs.release.outputs.new_version != ''
  runs-on: ubuntu-latest
  permissions:
    contents: read
    packages: write
  steps:
    - uses: actions/checkout@v4
      with:
        ref: main

    - uses: docker/setup-buildx-action@v3

    - uses: docker/login-action@v3
      with:
        registry: ghcr.io
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Build and push
      uses: docker/build-push-action@v6
      with:
        context: .
        target: production
        push: true
        tags: |
          ghcr.io/${{ github.repository }}:${{ needs.release.outputs.new_version }}
          ghcr.io/${{ github.repository }}:latest
        build-args: |
          NEXT_PUBLIC_SUPABASE_URL=${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY=${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          NEXT_PUBLIC_GIPHY_API_KEY=${{ secrets.NEXT_PUBLIC_GIPHY_API_KEY }}
          NEXT_PUBLIC_GOCLAW_URL=${{ secrets.NEXT_PUBLIC_GOCLAW_URL }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

    - name: Deploy via Dokploy webhook
      if: always() && steps.build-push.outcome == 'success'
      continue-on-error: true
      run: |
        curl -sf -X POST "${{ secrets.DOKPLOY_WEBHOOK_URL }}" \
          || echo "Dokploy webhook failed (non-fatal)"
```

### Key Details

- **`ref: main`**: Checkout the commit semantic-release just tagged (after version bump)
- **`target: production`**: Use the production stage of multi-stage Dockerfile
- **`cache-from/to: type=gha`**: GitHub Actions cache for Docker layers — speeds up subsequent builds
- **`continue-on-error: true`** on webhook: Dokploy being down shouldn't fail the pipeline
- **`github.repository`**: Auto-resolves to `<owner>/agent-playground` (lowercase)
- **Dokploy webhook**: Dokploy provides a simple webhook URL per application — just POST to it to trigger redeploy. No body/secret needed (URL itself is the secret).

## Todo

- [ ] Add `outputs` block to release job
- [ ] Add `packages: write` to permissions
- [ ] Add docker job with build, push, and webhook steps
- [ ] Verify `GITHUB_TOKEN` has packages:write (automatic with permissions block)

## Notes

- `GITHUB_TOKEN` is auto-provided — no extra secrets needed for GHCR auth
- Image name auto-lowercased by GHCR (GitHub requirement)
- First push creates the GHCR package; visibility inherits from repo settings
