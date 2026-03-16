# Phase 4: Client — Logout Cleanup + Kicked-Session Toast

**Priority:** Medium
**Status:** pending
**Effort:** Small

## Context

- Client auth: `src/lib/auth.ts`
- Login page: `src/app/login/page.tsx`
- Existing toast system: sonner (used for presence toasts)

## Overview

1. On logout: delete current session from `user_sessions`
2. On login: if response includes `kicked_session`, show toast notification

## Requirements

- Logout must clean up session record
- Toast shows device name and last active time of kicked session
- Use existing sonner toast infrastructure

## Related Code Files

**Modify:**
- `src/lib/auth.ts` — delete session record on logout, return kicked_session from login
- `src/app/login/page.tsx` — show toast when kicked_session present

## Implementation Steps

### 1. Update `src/lib/auth.ts` — loginWithToken

Add `kicked_session` to return value:

```typescript
export async function loginWithToken(token: string) {
  // ... existing fetch logic ...
  return {
    ...data.user,
    needsSetup: !data.user.avatar_url,
    kickedSession: data.kicked_session || null,
  };
}
```

### 2. Update `src/lib/auth.ts` — logout

Before calling `supabase.auth.signOut()`, delete the session record:

```typescript
export async function logout() {
  const supabase = createBrowserSupabaseClient();

  // Read session_id cookie to identify which session to delete
  // OR: delete all sessions for current user (simpler, since we're logging out)
  // Since signOut clears the JWT, we need to delete BEFORE signing out

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("user_sessions").delete().eq("user_id", user.id);
    // This deletes only THIS user's sessions (RLS enforced)
    // In practice, should delete only current session by session_id cookie
  }

  await supabase.auth.signOut();
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}
```

**Refinement:** If session_id cookie is available (from Phase 3), delete only that specific session. Otherwise, delete all for user (acceptable since user is logging out of this device).

### 3. Update `src/app/login/page.tsx`

After successful login, check for kicked_session and show toast:

```typescript
import { toast } from "sonner";

// In handleSubmit, after loginWithToken:
const loginUser = await loginWithToken(token);
if (loginUser.kickedSession) {
  const { device_name, last_active_at } = loginUser.kickedSession;
  const timeAgo = formatRelativeTime(last_active_at); // simple relative time
  toast.info(`Signed out from ${device_name} (${timeAgo})`);
}
router.push(loginUser.needsSetup ? "/setup" : "/chat");
```

### 4. Relative time formatting

Use simple helper (no new dependency):
```typescript
function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
```

## Todo

- [ ] Update loginWithToken return type
- [ ] Add session cleanup to logout
- [ ] Add kicked-session toast to login page
- [ ] Add relative time formatter
- [ ] Test: kicked session shows toast
- [ ] Test: logout removes session record

## Success Criteria

- Logging out removes session from `user_sessions`
- When 4th device logs in, toast appears: "Signed out from Safari on iOS (2h ago)"
- No toast when under session cap

## Security

- RLS ensures users can only delete their own sessions
- Session cleanup happens before auth signOut to retain JWT for the delete operation
