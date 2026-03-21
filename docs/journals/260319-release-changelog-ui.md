# Changelog Shipped: Security Lessons in Static Builds

**Date**: 2026-03-19 16:20
**Severity**: Medium (security review found 3 critical gaps)
**Component**: Release changelog page + version reload
**Status**: Merged with fixes required

## What Happened

Added `/changelog` page displaying GitHub releases fetched at build time (static). Version badge in sidebar links to changelog. Reused react-markdown + remark-gfm. Cap at 20 releases. Graceful fallback on API failure.

Feature ships. Data stale until next deploy. Users see release notes with proper Markdown rendering (tables, code blocks, lists).

## The Brutal Truth

This feature passed implementation. Then code review found **3 critical security issues** that should have been caught before touching a keyboard.

The painful part: the security gap on webhook secret comparison is so basic that it feels like a failure of discipline, not intelligence. Timing-safe string comparison is textbook security 101. We didn't even check.

This is what happens when you build first and think about security second. It works, sure. But it's broken in ways users will never see — until an attacker does.

## Technical Details

**Implementation facts**:
- `/changelog` page built at deployment time via GitHub Releases API (public repo, no auth token)
- Version in `package.json` injected as `NEXT_PUBLIC_APP_VERSION` at build time
- Dual-channel detection: Supabase broadcast + 5-minute polling for update notifications
- Version endpoint has no caching headers; broadcasts unchecked for failure
- CI workflow triggers webhook on release; webhook secret compared via simple `!==`

**Three critical security gaps found in review**:

1. **Timing-attack vulnerable secret comparison** (release-notify route):
   ```ts
   // WRONG:
   if (!secret || secret !== process.env.RELEASE_WEBHOOK_SECRET)

   // Attacker can measure response time to guess secret char-by-char
   ```
   Fix: Use `crypto.timingSafeEqual` with buffer comparison

2. **Unhandled JSON parse in webhook handler**: If malformed JSON arrives, `request.json()` throws and returns 500 with stack trace. Fix: wrap in try-catch, return 400

3. **Supabase broadcast failure not checked**: Endpoint returns `{ ok: true }` even if broadcast fails. Fix: check result, return 502 on failure

Plus 4 high-priority gaps:
- H1: No initial poll on mount (users wait 5 min if broadcast missed)
- H2: `NEXT_PUBLIC_APP_VERSION` baked at build time (documented edge case, acceptable)
- H3: Dismissed banner resets on duplicate webhook broadcast (UX nit)
- H4: Version endpoint missing `Cache-Control: no-store` header

## What We Tried

1. Simple string comparison — shipped it, security review caught it
2. Supabase broadcast alone — added polling as fallback, then removed error handling
3. JSON parse without guard — common pattern we didn't question until review

## Root Cause Analysis

Why did security gaps exist? **We optimized for speed, not robustness.**

- Used standard patterns without asking "what if this fails?"
- Webhook security copied from templates; didn't verify correctness
- No security checklist before pushing code
- Review happened after merge, not before

This is the cost of "move fast": we moved fast and left vulnerabilities open.

The deeper issue: webhook secret comparison feels so basic that we didn't stop to think. Timing-safe comparison is not intuitive to most devs. It should have been a code review checklist item.

## Lessons Learned

- **Security checklist before shipping API routes**:
  - Are secrets compared safely? (timingSafeEqual, not ===)
  - Is JSON parsing wrapped? (try-catch, not bare await json())
  - Are external calls checked for failure? (don't ignore async results)
  - Are caching headers correct? (especially versioning endpoints)

- **Webhook security is not optional**: Public endpoints with secrets need:
  - Timing-safe comparison
  - Error handling that doesn't leak info
  - Failure logging (for ops, not users)

- **Code review catches what we miss**: The security issues weren't discovered by testing or manual use. They appeared in code review. This means review must happen *before* merge, not after.

- **Build-time static data is safe but stale**: No security risk in static changelog, but users get outdated release notes until deploy. Document this tradeoff explicitly.

## Next Steps

1. **[Blocking]** Fix timing-safe secret comparison before accepting webhook traffic
2. **[Blocking]** Wrap JSON parse in try-catch in release-notify route
3. **[Blocking]** Check Supabase broadcast result before returning success
4. Add initial poll on hook mount (prevents 5-min delay on cold tab open)
5. Add version endpoint Cache-Control header
6. Document GitHub Actions secrets required (APP_URL, RELEASE_WEBHOOK_SECRET) in README
7. **[Future]** Add pre-commit hook to catch security patterns automatically

**Review finding**: Feature is solid architecturally (dual-channel detection is resilient), but execution has gaps. All three blocking issues are fixable in 30 min. Security shouldn't be an afterthought.
