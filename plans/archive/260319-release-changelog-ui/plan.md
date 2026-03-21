---
status: completed
---

# Release Changelog UI

**Date:** 2026-03-19
**Branch:** `feat/release-changelog-ui`
**Brainstorm:** [reports/brainstorm-260319-release-changelog.md](reports/brainstorm-260319-release-changelog.md)

## Summary

Add a `/changelog` page that displays GitHub release notes, fetched at build time (static). Sidebar version badge links to it.

## Phases

| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | Changelog page + data fetch | completed | `src/app/changelog/page.tsx`, `src/app/changelog/layout.tsx`, `src/app/changelog/release-body.tsx` |
| 2 | Sidebar version badge link | completed | `src/components/sidebar/sidebar.tsx` |

## Key Decisions

- Build-time static fetch from GitHub Releases API (public repo, no token)
- Reuse existing `react-markdown` + `remark-gfm` for rendering release bodies
- Auth required (existing middleware handles it — no changes needed)
- Cap at 20 releases
- Graceful fallback on API failure

## Dependencies

- `react-markdown` (already installed)
- `remark-gfm` (already installed)
- GitHub API: `GET /repos/phucsystem/agent-playground/releases`
