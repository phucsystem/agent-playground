# Phase 2: Login Route — Session Tracking + Cap Enforcement

**Priority:** High
**Status:** pending
**Effort:** Medium

## Context

- Login route: `src/app/api/auth/login/route.ts`
- Max 3 concurrent sessions per user
- Auto-kick oldest when cap exceeded

## Overview

Modify the login API route to:
1. Track new session in `user_sessions` on successful login
2. Enforce 3-session cap by revoking oldest session
3. Return kicked session info in response for client toast

## Requirements

- Parse user-agent header to extract device name
- Insert session record after successful Supabase Auth sign-in
- When user has >= 3 sessions, revoke oldest via Supabase Admin API
- Return `kicked_session` payload when a session was evicted

## Related Code Files

**Create:**
- `src/lib/session-utils.ts` — `parseDeviceName(userAgent)` helper + session management functions

**Modify:**
- `src/app/api/auth/login/route.ts` — add session tracking after sign-in
- `package.json` — add `ua-parser-js` dependency

## Implementation Steps

1. Install `ua-parser-js`:
   ```bash
   pnpm add ua-parser-js && pnpm add -D @types/ua-parser-js
   ```

2. Create `src/lib/session-utils.ts`:
   ```typescript
   import UAParser from "ua-parser-js";

   export function parseDeviceName(userAgent: string): string {
     const parser = new UAParser(userAgent);
     const browser = parser.getBrowser().name || "Unknown Browser";
     const os = parser.getOS().name || "Unknown OS";
     return `${browser} on ${os}`;
   }
   ```

3. Modify `src/app/api/auth/login/route.ts` — after `signInWithPassword` succeeds:

   ```
   // After signInData is obtained:
   a. Get user-agent from request headers
   b. Parse device name
   c. Query user_sessions COUNT for this user_id
   d. If count >= 3:
      - SELECT oldest session (ORDER BY last_active_at ASC LIMIT 1)
      - Call auth.admin.signOut(oldest.supabase_session_id) if session_id exists
      - DELETE oldest from user_sessions
      - Store kicked session info: { device_name, last_active_at }
   e. INSERT new session into user_sessions:
      - user_id, supabase_session_id (from signInData.session.id or access_token), device_name, user_agent
   f. Include kicked_session in response JSON (null if none kicked)
   ```

4. Updated response shape:
   ```json
   {
     "access_token": "...",
     "refresh_token": "...",
     "user": { ... },
     "kicked_session": {
       "device_name": "Safari on iOS",
       "last_active_at": "2026-03-17T08:00:00Z"
     }
   }
   ```

## Todo

- [ ] Install ua-parser-js
- [ ] Create session-utils.ts
- [ ] Modify login route with session tracking
- [ ] Test: login creates session record
- [ ] Test: 4th login kicks oldest session

## Success Criteria

- Login creates `user_sessions` row
- 4th login for same user removes oldest + returns kicked_session
- Supabase Admin API revokes the kicked session's JWT

## Risk

- Supabase `signInWithPassword` session ID: need to verify what `signInData.session` exposes. If no session ID, use access_token hash as identifier.
- Race condition on concurrent logins: low risk for 3-session cap, but could add advisory lock if needed later.

## Security

- Session operations use service role (server-side only)
- No session data exposed to unauthorized users via RLS
