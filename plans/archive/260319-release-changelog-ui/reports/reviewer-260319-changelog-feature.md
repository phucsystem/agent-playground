# Code Review: Release Changelog UI

**Date:** 2026-03-19
**Branch:** `fix/delete-message-confirm-modal` (contains changelog files)
**Reviewer:** code-reviewer

---

## Scope

- Files: `src/app/changelog/layout.tsx`, `src/app/changelog/page.tsx`, `src/app/changelog/release-body.tsx`, `src/components/sidebar/sidebar.tsx`
- LOC: ~130 (new) + 1 line changed (sidebar)
- Focus: correctness, security, design tokens, code quality

---

## Overall Assessment

Clean, well-structured implementation. Good use of existing dependencies (`react-markdown`, `remark-gfm`). Graceful error handling on API failure. A few items warrant attention around XSS surface, `force-static` behavior, and DRY opportunity.

---

## Critical Issues

### C1. XSS surface via `react-markdown` rendering of untrusted GitHub content

**File:** `src/app/changelog/release-body.tsx`

`ReactMarkdown` by default does NOT render raw HTML -- it strips HTML tags. This is safe. However, the risk profile changes if anyone later adds `rehype-raw` (which is already in the project's dependencies via `rehype-highlight`). Currently safe, but warrants a defensive comment or explicit `rehype-sanitize` plugin.

**Impact:** Low-probability now (GitHub sanitizes release bodies too), but defense-in-depth is missing.

**Recommendation:** Either add `rehype-sanitize` as an explicit safeguard, or add a brief comment noting that raw HTML rendering must never be enabled on this component since content comes from GitHub API (semi-trusted but user-authored).

---

## High Priority

### H1. `force-static` + `fetch()` behavior in Next.js 15/16

**File:** `src/app/changelog/page.tsx:6`

`export const dynamic = "force-static"` with a `fetch()` call inside the Server Component means the fetch runs once at **build time** and the page is fully static thereafter. This is the intended behavior per the plan ("fetched at build time").

However, there is no `revalidate` export. The page will NEVER update until the next full build/deploy. For a changelog page this is acceptable IF deploys happen on each release (which semantic-release + CI should trigger). But if someone hotfixes without a release, the changelog becomes stale.

**Recommendation:** Consider adding `export const revalidate = 3600` (1 hour) as ISR fallback so the page self-refreshes periodically without requiring a redeploy. This is a low-cost safety net. If the intent is strictly build-time-only, add a comment explaining why.

### H2. GitHub API rate limiting -- unauthenticated requests

**File:** `src/app/changelog/page.tsx:19-24`

Unauthenticated GitHub API requests are limited to 60/hour per IP. During CI builds (shared runners), this can fail. The graceful fallback (`return []`) handles this, but:

- Build will silently produce an empty changelog page with no warning in build logs
- No `console.warn` or build-time logging of the failure reason

**Recommendation:** Add a `console.warn` in the catch/error path so build logs surface the issue:
```ts
if (!response.ok) {
  console.warn(`[changelog] GitHub API returned ${response.status}`);
  return [];
}
```

---

## Medium Priority

### M1. DRY opportunity -- `ReleaseBody` duplicates markdown styling

**File:** `src/app/changelog/release-body.tsx` vs `src/components/chat/markdown-content.tsx`

Both components use `ReactMarkdown` + `remarkGfm` with long Tailwind class strings for markdown styling. The styling diverges intentionally (chat has mentions, copy buttons, etc.), but the base markdown CSS classes are largely duplicated.

**Impact:** Maintenance burden if design tokens change.

**Recommendation:** Acceptable for now given the different contexts (chat vs changelog). If a third markdown renderer appears, extract shared prose styles into a utility class or Tailwind `@apply` block.

### M2. Layout hardcodes `bg-white` -- no dark mode token

**File:** `src/app/changelog/layout.tsx:3`

`bg-white` is hardcoded. UI_SPEC defines `--color-background: #FFFFFF` for light mode. If dark mode is ever added, this won't adapt.

**Recommendation:** Use `bg-white` is fine for now (app is light-only per UI_SPEC). No action needed unless dark mode is planned.

### M3. `index` used as secondary key signal in map

**File:** `src/app/changelog/page.tsx:67`

The `key={release.id}` is correct (using stable ID). The `index` parameter is only used for the divider conditional (`index < releases.length - 1`), which is fine. No issue here -- just noting the pattern is correct.

---

## Low Priority

### L1. Sidebar version link has no `aria-label`

**File:** `src/components/sidebar/sidebar.tsx:111`

The version badge link `<Link href="/changelog">` has no `aria-label`. Screen readers will read "v1.4.1" which is somewhat meaningful but could be clearer.

**Recommendation:** Add `aria-label="View release notes"`.

### L2. Empty layout wrapper may be unnecessary

**File:** `src/app/changelog/layout.tsx`

The layout only adds `min-h-dvh bg-white`. This could be applied directly to the page's root div. However, having a layout is conventional for Next.js route groups and costs nothing.

**Recommendation:** Keep as-is. Standard pattern.

---

## Edge Cases Found by Scout

1. **Auth required:** `/changelog` is NOT in the middleware's public pages list (`/login`, `/setup`). Unauthenticated users are redirected to `/login`. This is correct -- changelog is behind auth.

2. **Empty release body:** `release.body && <ReleaseBody>` correctly guards against null/empty bodies. No render if body is missing.

3. **Release with null name:** `release.name || release.tag_name` correctly falls back to tag name.

4. **GitHub API returns non-JSON:** The `response.json()` call could throw if GitHub returns malformed JSON. The outer `try/catch` handles this. Safe.

5. **`packageJson.version` import:** Both `page.tsx` and `sidebar.tsx` import from `../../../package.json`. This works in Next.js (bundled at build time, not shipped to client). The version in the header ("v1.4.1") may differ from the latest release tag if someone forgets to bump -- but semantic-release handles this automatically, so low risk.

---

## Positive Observations

- Clean separation: layout, page (server), release-body (client) follows Next.js app router conventions
- Graceful degradation on API failure (empty state with helpful message)
- No secrets exposed -- public GitHub API, no token needed
- Proper `rel="noopener noreferrer"` on external links
- Design tokens consistent with UI_SPEC (neutral-400, neutral-800, primary-500, primary-50)
- Minimal dependencies -- reuses existing `react-markdown` and `remark-gfm`
- Sidebar change is minimal and clean (just wrapping `<p>` with `<Link>`)

---

## Recommended Actions

1. **[High]** Add `console.warn` on GitHub API failure for build-log observability
2. **[High]** Consider `export const revalidate = 3600` for ISR, or document why build-only is sufficient
3. **[Low]** Add `aria-label="View release notes"` to sidebar version link
4. **[Low]** Add a comment in `release-body.tsx` noting raw HTML rendering must not be enabled

---

## Metrics

- Type Coverage: N/A (no complex types; `GitHubRelease` interface is well-typed)
- Test Coverage: Not assessed (no tests requested per plan)
- Linting Issues: 0 (no syntax issues found)

---

## Plan TODO Verification

| Phase | Task | Status |
|-------|------|--------|
| 1 | Changelog page + data fetch | Done (files exist, implementation complete) |
| 2 | Sidebar version badge link | Done (`<p>` replaced with `<Link>`) |

Plan status should be updated from `pending` to `complete`.
