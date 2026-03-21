# Release Pipeline - No New Tag Investigation
Date: 2026-03-18

## Executive Summary

The release pipeline is working correctly — it ran successfully after the most recent merge to `main` (#11) but produced **no new tag** because semantic-release determined there were no "relevant" commits. The root cause is that the **squash-merged PR title** (`Sidebar realtime sync and message read fixes (#11)`) does not match semantic-release's Angular commit convention, and the **body commits** containing `feat:` / `fix:` prefixes are not parsed from the squash commit body.

Current latest tag: `v1.3.0` (set after PR #10)

---

## Technical Analysis

### Pipeline Structure

`.github/workflows/ci.yml` runs on push to `main`:
1. **typecheck** → `tsc --noEmit`
2. **build** → `next build`
3. **release** → `pnpm exec semantic-release` (depends on `build`)

Release job uses `secrets.SEMANTIC_RELEASE_TOKEN` (PAT) to bypass branch protection and push tags/changelog.

### Semantic-Release Config (`.releaserc.json`)

Plugins in order:
- `@semantic-release/commit-analyzer` — determines release type from commits
- `@semantic-release/release-notes-generator`
- `@semantic-release/changelog` — writes `CHANGELOG.md`
- `@semantic-release/npm` — bumps `package.json` version (no publish)
- `@semantic-release/git` — commits `CHANGELOG.md` + `package.json` back, tagged `chore(release): X.Y.Z [skip ci]`
- `@semantic-release/github` — creates GitHub release

### What Happened in Run #23218346833

From the semantic-release log:

```
› ℹ  Found git tag v1.3.0 associated with version 1.3.0 on branch main
› ℹ  Found 2 commits since last release
```

The 2 commits analyzed:

| Commit | Title | Decision |
|--------|-------|----------|
| Squash merge #11 | `Sidebar realtime sync and message read fixes (#11)` | **no release** |
| Squash merge #10 | `UI bug fixes: conversations sidebar enhancements (#10)` | **no release** |

Wait — PR #10 was already included in `v1.3.0` (its individual commits are in the squash body, and `chore(release): 1.3.0` commit came after it). Semantic-release only sees 2 commits since `v1.3.0`, both of which are squash merge commits whose **titles** lack `feat:` / `fix:` / `perf:` prefixes.

The squash body contains the individual branch commits (`feat: add ConversationsContext`, `fix: sidebar realtime sync`, etc.) but the Angular commit convention parser only reads the **first line** (the commit title) by default, not the body. So these `feat:` and `fix:` lines in the body are **ignored**.

```
[semantic-release] [@semantic-release/commit-analyzer] › ℹ  The commit should not trigger a release
[semantic-release] › ℹ  There are no relevant changes, so no new version is released.
```

### Root Cause

**PR titles used for squash merges do not follow Angular commit convention** (no `feat:`, `fix:`, `perf:` prefix). Semantic-release's `commit-analyzer` only parses the commit subject line. The individual branch commits (which do follow the convention) are folded into the squash body and are ignored.

Examples of non-triggering PR titles:
- `Sidebar realtime sync and message read fixes (#11)` — no prefix
- `UI bug fixes: conversations sidebar enhancements (#10)` — no Angular prefix

Examples that DID trigger releases (from git log):
- `feat: chat UI polish, snippet cards, and sidebar search (#9)` → triggered `v1.2.1` → then `v1.3.0`

---

## Actionable Recommendations

### Fix (Required): Enforce Angular-format PR titles

The squash merge commit title must start with a valid Angular prefix. Two options:

**Option A — Enforce via GitHub branch protection (recommended)**

Add a PR title linting GitHub Action (e.g., `amannn/action-semantic-pull-request`) so PRs with non-conforming titles are blocked from merging.

```yaml
# .github/workflows/pr-title-check.yml
name: PR Title Check
on:
  pull_request:
    types: [opened, edited, synchronize]
jobs:
  check-title:
    runs-on: ubuntu-latest
    steps:
      - uses: amannn/action-semantic-pull-request@v5
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Option B — Use merge commit strategy instead of squash**

Switch to regular merge commits. Semantic-release will then analyze each individual commit (`feat:`, `fix:`, etc.) which are already properly formatted.

### Immediate: Manually create the missing tag

The 5 commits merged via PR #11 since `v1.3.0` include multiple `feat:` and `fix:` entries — these would have triggered a **minor bump** (`v1.4.0`). To recover:

```bash
# After merging the fix above, the next CI run will create the tag automatically
# OR manually trigger semantic-release locally with proper env vars
```

---

## Evidence

- Run ID: `23218346833` — status: success, no release created
- Key log line: `There are no relevant changes, so no new version is released.`
- PR #11 squash title: `Sidebar realtime sync and message read fixes (#11)` — no Angular prefix
- Commits in body that WOULD have triggered release: `feat: add ConversationsContext`, `fix: sidebar realtime sync`, `fix: only mark conversation as read when receiving new messages`

---

## Unresolved Questions

- Should the project switch from squash merges to regular merges, or enforce semantic PR titles? This is an architectural/workflow decision.
- Is there an existing GitHub branch ruleset that could have the PR title check added, or does a new workflow need to be created?
