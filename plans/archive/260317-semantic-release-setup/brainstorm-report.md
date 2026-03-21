# Brainstorm: Semantic Release Setup

**Date:** 2026-03-17
**Status:** Agreed
**Decision:** semantic-release + Husky/commitlint + GitHub Actions + branch protection

---

## Problem Statement

Project currently commits directly to `main` with no version automation. Need:
- Feature branch workflow enforced
- Automatic version bumping on merge to main (SemVer via conventional commits)
- Changelog generation + GitHub Releases
- Commit message linting

## Evaluated Approaches

### Option A: semantic-release (CHOSEN)
- Auto-parses conventional commits → determines SemVer bump
- Mature (2.3M weekly downloads), single-package focus
- Zero manual steps after merge
- **Pros:** Full automation, battle-tested, plugin ecosystem
- **Cons:** Weak monorepo support (irrelevant — single package)

### Option B: release-please (Google)
- Creates "Release PR" → human merges → release happens
- **Pros:** Review gate before release
- **Cons:** Extra PR friction, pnpm workspace quirks
- **Rejected:** User wants full automation, no manual gates

### Option C: changesets (Atlassian)
- Manual `.changeset/*.md` files → CI publishes
- **Pros:** Best monorepo support, explicit control
- **Cons:** Manual step per change, overkill for single package
- **Rejected:** Designed for monorepos, too much friction

## Agreed Solution

### Toolchain

| Layer | Tool | Purpose |
|-------|------|---------|
| Commit enforcement | husky + @commitlint/cli | Reject non-conventional commits locally |
| Version automation | semantic-release | Auto bump + CHANGELOG.md + GitHub Release |
| CI/CD | GitHub Actions | lint → build → release on merge to main |
| Branch workflow | GitHub branch protection | Require PR to main, require CI pass |

### Version Bump Rules

| Commit prefix | SemVer bump | Example |
|---------------|-------------|---------|
| `fix:` | PATCH (0.1.1) | `fix: avatar crop not saving` |
| `feat:` | MINOR (0.2.0) | `feat: agent chat history` |
| `feat!:` / `BREAKING CHANGE:` | MAJOR (1.0.0) | `feat!: new auth system` |
| `docs:`, `chore:`, `refactor:`, `ci:` | No release | `docs: update README` |

### semantic-release Plugins

```json
[
  "@semantic-release/commit-analyzer",
  "@semantic-release/release-notes-generator",
  "@semantic-release/changelog",
  "@semantic-release/npm",
  "@semantic-release/github",
  "@semantic-release/git"
]
```

**Flow:** analyze commits → generate notes → update CHANGELOG.md → bump package.json → create GitHub Release → commit version files back

### GitHub Actions Workflow

```
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint → build → release (main only)
```

- `fetch-depth: 0` required (semantic-release needs full git history)
- `GITHUB_TOKEN` auto-provided, sufficient for GitHub Releases
- No npm publish needed (not a library)

### Branch Protection Rules

- Require PR before merging to main
- Require status checks to pass (lint + build)
- No direct pushes to main
- Allow force push: disabled
- Allow deletion: disabled

### Developer Workflow (Post-Setup)

```
1. git checkout -b feature/my-feature
2. Work + commit with conventional format (enforced by commitlint)
3. Push branch → PR auto-created or manually created
4. CI runs lint + build on PR
5. Merge PR to main
6. CI auto-runs semantic-release → version bump + changelog + GitHub Release
```

## Implementation Considerations

- **Initial version:** Keep 0.1.0, semantic-release will manage from here
- **No npm publish:** Configure semantic-release to skip npm publish (`"npmPublish": false` in package.json or plugin config)
- **CHANGELOG.md:** Will be auto-generated, committed back by `@semantic-release/git`
- **Git user for CI:** semantic-release uses `semantic-release-bot` by default
- **Existing commits:** Only commits after setup will trigger releases

## Packages to Install

```bash
# Dev dependencies
pnpm add -D semantic-release @semantic-release/changelog @semantic-release/git
pnpm add -D husky @commitlint/cli @commitlint/config-conventional
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `.releaserc.json` | Create — semantic-release config |
| `commitlint.config.cjs` | Create — commitlint config |
| `.husky/commit-msg` | Create — git hook for commitlint |
| `.github/workflows/ci.yml` | Create — CI/CD pipeline |
| `package.json` | Modify — add scripts, set `"private": true` or `"npmPublish": false` |

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| semantic-release commits back (CHANGELOG) could trigger loop | `[skip ci]` in commit message (default behavior) |
| Protected branch blocks bot commits | Grant GitHub Actions write permission or use PAT |
| Accidental MAJOR bump | Use `feat!:` sparingly, review PR titles |

## Success Criteria

- [ ] Conventional commits enforced locally via husky + commitlint
- [ ] Direct push to main blocked
- [ ] PR merge triggers automatic version bump
- [ ] CHANGELOG.md auto-generated
- [ ] GitHub Release created with release notes
- [ ] Non-release commits (docs, chore) don't trigger release

## Next Steps

Create implementation plan with phases:
1. Install dependencies + configure commitlint + husky
2. Configure semantic-release
3. Create GitHub Actions workflow
4. Set up branch protection rules
5. Test end-to-end with a feature branch
