# Brainstorm: Release Changelog UI

**Date:** 2026-03-19
**Status:** Agreed
**Scope:** Add `/changelog` page fetching GitHub releases at build time

## Problem

No way for users to see release notes in the app. They live only on GitHub.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Placement | Dedicated `/changelog` page | Clean, scrollable, room for detail |
| Data source | Build-time static fetch | Zero runtime cost; deploy auto-triggers after semantic-release |
| Navigation | Sidebar version badge | Minimal footprint, discoverable |
| Auth | Required (behind existing middleware) | Consistent with app auth model |
| Repo | Public | No token needed |

## Architecture

```
GitHub Releases API (build time only)
  → fetch in Server Component (force-static)
  → /changelog page (static HTML)

Sidebar footer: "v1.4.1" badge → links to /changelog
```

## Implementation

- 1 new page: `src/app/changelog/page.tsx`
- 1 sidebar mod: version badge in footer
- Render release markdown with existing `react-markdown` + `remark-gfm`
- Limit to 20 most recent releases
- Fallback: graceful empty state if GitHub API fails at build

## Rejected Alternatives

- **Client-side fetch**: Rate limits, unnecessary for deploy-triggered data
- **ISR API route**: Over-engineered; deploy already rebuilds
- **Local CHANGELOG.md parse**: Loses GitHub metadata (author, URLs, assets)

## Risks

- GitHub API down at build → fallback to empty state or local CHANGELOG.md
- Many releases → paginate or cap at 20

## Success Criteria

- `/changelog` renders releases with version, date, notes
- Sidebar shows version badge linking to changelog
- Static HTML, zero runtime API calls
- Auto-updates on deploy
