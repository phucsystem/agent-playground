# Phase 1: Changelog Page + Data Fetch

**Priority:** High
**Status:** Completed

## Overview

Create `/changelog` route with a Server Component that fetches GitHub releases at build time and renders them as a scrollable release history page.

## Architecture

```
Build time:
  fetch("https://api.github.com/repos/phucsystem/agent-playground/releases?per_page=20")
    → parse JSON → render static HTML

Runtime:
  User visits /changelog → served as static HTML (no API calls)
```

## Related Code Files

**Create:**
- `src/app/changelog/layout.tsx` — Layout wrapper (reuses chat layout for sidebar + auth)
- `src/app/changelog/page.tsx` — Server Component, static data fetch, release list

**Reference (read-only):**
- `src/components/chat/markdown-content.tsx` — Existing markdown renderer pattern
- `src/app/chat/layout.tsx` — Layout pattern reference

## Implementation Steps

1. **Create `src/app/changelog/layout.tsx`**
   - Import and reuse the chat layout pattern so sidebar remains visible
   - OR make it a standalone page with a back button (simpler, avoids coupling to chat layout)
   - Decision: standalone page with back-to-chat link (KISS — avoids needing all chat context providers just for changelog)

2. **Create `src/app/changelog/page.tsx`**
   - Server Component (no "use client")
   - `export const dynamic = "force-static"` for build-time fetch
   - Fetch GitHub releases API: `https://api.github.com/repos/phucsystem/agent-playground/releases?per_page=20`
   - Type the response (tag_name, name, body, published_at, html_url)
   - Wrap fetch in try/catch → empty array fallback
   - Render release list:
     - Each release: version tag, formatted date, rendered markdown body
     - Use `ReactMarkdown` + `remarkGfm` for body rendering (client component wrapper needed)
     - Link to GitHub release page per entry
   - Empty state: "No releases found" message
   - Back link to `/chat`

3. **Create release markdown renderer**
   - Can reuse or extract from `markdown-content.tsx`
   - Simpler version: no copy button needed, just formatted markdown
   - Keep as a small client component within the page file or extract if >50 lines

## Design

- Match app design tokens (neutral scale, typography)
- Clean, readable layout with proper spacing
- Version tag as heading, date as muted text
- Release body rendered as markdown below
- Subtle divider between releases
- Responsive: works on mobile

## Todo

- [x] Create changelog layout
- [x] Create changelog page with GitHub fetch
- [x] Render releases with react-markdown
- [x] Add empty/error fallback state
- [x] Add back navigation to chat
- [x] Verify build-time static generation works

## Success Criteria

- `pnpm build` fetches releases and generates static HTML
- `/changelog` renders release history with proper markdown
- Page loads instantly (no runtime API calls)
- Graceful fallback if GitHub API unreachable at build time

## Risk

- GitHub API rate limit during build: unlikely (1 call, 60/hr limit)
- API down at build: fallback to empty state, non-blocking
