# Semantic Release Automation: Zero-Touch Version Bumping

**Date**: 2026-03-17 16:00
**Severity**: Medium
**Component**: Release pipeline (CI/CD, versioning, changelog)
**Status**: Resolved

## What Happened

Implemented semantic-release + husky + commitlint + GitHub Actions to eliminate manual versioning. Every merge to main now triggers automatic version bump (SemVer), CHANGELOG generation, and GitHub Release creation. Conventional commit enforcement prevents human error. Currently running at v1.12.0 with zero manual release steps.

## The Brutal Truth

This took longer to architect than to implement because we evaluated three competing approaches (semantic-release vs release-please vs changesets) before committing. The right choice was obvious in retrospect: semantic-release for single-package projects, minimal CI complexity, battle-tested at scale. What's frustrating is we spent days discussing toolchain theory when the decision was really binary: automation vs manual gates. Turns out full automation wins.

## Technical Details

**Toolchain stack:**
- `semantic-release`: Parses conventional commits → determines SemVer bump → creates release
- `husky` + `@commitlint/cli`: Enforce conventional commit format locally (rejects `git commit` if non-compliant)
- `GitHub Actions`: CI runs lint → build → semantic-release on main branch only
- GitHub branch protection: Require PR, require CI pass, no direct main pushes

**SemVer rules:**
```
feat:           → MINOR bump (0.2.0)
feat!:/BREAKING → MAJOR bump (1.0.0)
fix:            → PATCH bump (0.1.1)
docs:/chore:    → No release
```

**semantic-release plugins:**
1. `@semantic-release/commit-analyzer` — detect bump type from commits
2. `@semantic-release/release-notes-generator` — generate changelog entries
3. `@semantic-release/changelog` — write CHANGELOG.md
4. `@semantic-release/npm` — bump package.json (we skip npm publish)
5. `@semantic-release/github` — create GitHub Release
6. `@semantic-release/git` — commit version files back with `[skip ci]`

**Flow:**
```
[merge PR to main] → CI triggers → lint → build → semantic-release
  → analyze commits → detect version bump
  → update CHANGELOG.md + package.json
  → create GitHub Release
  → commit files back with [skip ci]
  → (CI skips re-running on bot commit)
```

**Developer workflow (unchanged):**
1. Feature branch with conventional commits enforced
2. Open PR, CI validates
3. Merge PR
4. Automatic everything after merge (zero manual steps)

## What We Tried

**Option A: semantic-release** (chosen)
- Pros: Full automation, 2.3M weekly downloads, mature ecosystem
- Cons: None significant for single-package projects

**Option B: release-please** (rejected)
- Creates Release PR → human merges → release fires
- Pros: Review gate before release
- Cons: Extra friction, pnpm workspace quirks (not relevant)

**Option C: changesets** (rejected)
- Manual `.changeset/*.md` files → CI publishes
- Pros: Best monorepo support, explicit control
- Cons: Manual per-change overhead, overkill

Decision: Full automation wins. Review gate (release-please) sounded good but added workflow friction. Manual changesets clearly overkill.

## Root Cause Analysis (Why This Matters)

**Before:** Manual versioning = cognitive load + human error + release anxiety
- Forget to bump version = downstream CI failures
- Inconsistent changelog format = unhelpful release notes
- Merge conflicts on CHANGELOG.md common
- Release day = manual, error-prone ceremony

**Semantic-release eliminates the ceremony:** Commits → release is deterministic and automated. No "did we bump minor or patch?" questions. No inconsistent changelogs.

**Conventional commits are the enabler:** `feat:` vs `fix:` vs `docs:` forces developers to categorize changes. This enables automation. Without this discipline, versioning stays manual.

## Lessons Learned

1. **Conventional commits scale:** Once enforced, they become second nature. Developers stop thinking about it. husky makes it frictionless (rejects at commit time with clear error).

2. **Full automation > review gates:** Tempting to add human review before release (release-please style). But for active projects, review gate becomes a bottleneck. Automation is better.

3. **Bot commits need `[skip ci]`:** semantic-release's git plugin commits CHANGELOG + package.json back. These bot commits must skip CI (via `[skip ci]` footer) or infinite CI loop. Default behavior handles this correctly.

4. **Branch protection enables automation:** Protect main branch from direct pushes. This forces PRs → CI validation → merge → semantic-release. Without protection, releases could happen on ad-hoc commits.

5. **CHANGELOG.md is documentation:** Auto-generated changelogs are only useful if conventional commits are meaningful. Bad commit messages → bad changelog. Enforce quality upstream.

## Next Steps

- Monitor first few releases for correctness (watch for accidental MAJOR bumps from `feat!:`)
- Document conventional commit format in contributing guide
- Add pre-commit hook to prevent `feat!:` without careful thought
- Track release frequency (alerts if no releases in 2+ weeks suggests commit quality issues)
- Plan: add release notes distribution to Slack/email if volume justifies
