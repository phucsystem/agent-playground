# Phase 2: Sidebar Version Badge Link

**Priority:** Medium
**Status:** Completed
**Depends on:** Phase 1

## Overview

Turn the existing `v1.4.1` text in sidebar footer into a clickable link to `/changelog`.

## Related Code Files

**Modify:**
- `src/components/sidebar/sidebar.tsx` — Line 111: change `<p>` to `<Link>`

## Implementation Steps

1. **Update sidebar.tsx**
   - Line 111: Replace `<p className="text-[10px] text-neutral-400 text-center pt-1">v{packageJson.version}</p>`
   - With: `<Link href="/changelog" className="text-[10px] text-neutral-400 hover:text-primary-500 text-center pt-1 block transition">v{packageJson.version}</Link>`
   - `Link` already imported at line 9

## Todo

- [x] Replace version `<p>` tag with `<Link>` to `/changelog`
- [x] Add hover styling for discoverability

## Success Criteria

- Version badge is clickable
- Navigates to `/changelog` on click
- Hover state indicates interactivity
