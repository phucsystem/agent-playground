# Code Review: Browser Notification + Sound Feature

**Date:** 2026-03-17
**Reviewer:** code-reviewer
**Scope:** 6 files (migration, types, hook, UI toggle, layout integration, audio asset)
**Focus:** Correctness, edge cases, security, performance

---

## Overall Assessment

Solid implementation. Clean hook design, good use of refs to avoid stale closures, proper cleanup on unmount, and sensible BroadcastChannel dedup strategy. A few issues found ranging from medium to high priority.

---

## Critical Issues

None.

---

## High Priority

### H1. `notification_enabled` exposed to all authenticated users via `users_public` view

**File:** `supabase/migrations/015_notification_preferences.sql` (line 5-9)

The `users_public` view now includes `notification_enabled` for every user. This is a privacy leak -- any authenticated user can see whether another user has notifications on/off. While not catastrophic, this column is a personal preference with no legitimate cross-user use case.

**Fix:** Remove `notification_enabled` from the `users_public` view. The client only needs this for the *current* user, which is already fetched from the `users` table directly (via the `users_update_self` RLS policy allows reading own row).

```sql
CREATE OR REPLACE VIEW users_public AS
  SELECT id, email, display_name, avatar_url, role, is_agent, is_active, is_mock, last_seen_at, created_at
  FROM users;
```

Verify the `useCurrentUser` hook fetches from `users` table (not view) so own `notification_enabled` is still accessible.

### H2. `handledMessageIds` set grows unbounded (memory leak)

**File:** `src/hooks/use-notification-sound.ts` (line 25)

The `handledMessageIds` ref set never gets pruned. In a long-lived session with active conversations, this will grow indefinitely. Across multiple tabs, each tab also adds IDs via BroadcastChannel.

**Fix:** Cap the set size or use a TTL-based eviction:

```typescript
const MAX_HANDLED_IDS = 500;

// After adding:
if (handledMessageIds.current.size > MAX_HANDLED_IDS) {
  const entries = [...handledMessageIds.current];
  handledMessageIds.current = new Set(entries.slice(-250));
}
```

### H3. Multi-tab dedup is best-effort, not guaranteed

**File:** `src/hooks/use-notification-sound.ts` (lines 108-114)

The current BroadcastChannel approach has a race condition: two tabs can both check `handledMessageIds` before either posts the "claimed" message. Both tabs will play the sound.

The 3s debounce mitigates this in practice (if sound plays in tab A, tab B's debounce prevents double-play within the window). However, native notifications will still fire from both tabs since `showNativeNotification` has no debounce.

**Fix (low-effort):** Add the same tag to native notifications (already done -- `tag: "agent-playground-notification"` collapses duplicates in most browsers). This is actually already handled. The remaining race is harmless given debounce. Document this as an accepted trade-off.

---

## Medium Priority

### M1. `@mention` matching is fragile

**File:** `src/hooks/use-notification-sound.ts` (lines 102-104)

```typescript
const hasMention = message.content
  ?.toLowerCase()
  .includes(`@${currentUser.display_name.toLowerCase()}`);
```

Problems:
- Display names with special regex chars or spaces will cause false positives/negatives (e.g., `@Alice Bob` matches `Hi @Alice Bobby`)
- No word boundary check -- `@Alice` matches inside `@AliceInWonderland`
- If display name changes, old messages won't retroactively match (acceptable for real-time)

**Fix:** Use word-boundary matching:

```typescript
const mentionPattern = `@${currentUser.display_name.toLowerCase()}`;
const hasMention = message.content?.toLowerCase().includes(mentionPattern)
  && (message.content.toLowerCase().indexOf(mentionPattern) + mentionPattern.length === message.content.length
    || !/\w/.test(message.content[message.content.toLowerCase().indexOf(mentionPattern) + mentionPattern.length]));
```

Or simpler: split on whitespace and check tokens. This is acceptable as-is for MVP but should be revisited if mention UX becomes richer (e.g., `@user_id` based mentions).

### M2. No conversation membership check in realtime listener

**File:** `src/hooks/use-notification-sound.ts` (lines 83-87)

The subscription listens to ALL message INSERTs on the `messages` table (filtered by Supabase RLS). If RLS is properly enforced on realtime (which Supabase does for postgres_changes), this is fine. However, the local filter at line 96-99 also checks against `conversationsRef.current` -- messages for conversations not yet loaded will be silently dropped. This is correct behavior but worth noting: if a user is added to a new conversation and hasn't refreshed, they won't get notifications for it until the conversation list refreshes.

**Impact:** Low. The `useConversations` hook likely has its own realtime subscription that adds new conversations.

### M3. Optimistic UI without rollback notification

**File:** `src/components/sidebar/user-profile.tsx` (lines 25-39)

The toggle uses optimistic update (sets state before API call) and rolls back on error. Good pattern, but there's no user feedback on failure. The toggle will flash and revert silently.

**Fix:** Add a toast on error:

```typescript
if (error) {
  setNotificationEnabled(!newValue);
  toast.error("Failed to update notification preference");
}
```

### M4. `notification_enabled` state in UserProfile can drift from parent

**File:** `src/components/sidebar/user-profile.tsx` (line 15-16)

`useState(currentUser.notification_enabled)` only initializes from props. If `currentUser` object is re-fetched (e.g., after another tab changes the setting), the local state won't update. This is a common React anti-pattern.

**Fix:** Either derive from props directly or sync with `useEffect`:

```typescript
useEffect(() => {
  setNotificationEnabled(currentUser.notification_enabled);
}, [currentUser.notification_enabled]);
```

---

## Low Priority

### L1. Audio element created unconditionally

**File:** `src/hooks/use-notification-sound.ts` (lines 29-35)

The `Audio` element is created even when `notification_enabled` is false. Minor waste.

**Impact:** Negligible -- single DOM element, no network request until `.play()`.

### L2. Missing migration number 014

The migrations jump from `013_user_sessions.sql` to `015_notification_preferences.sql`. Migration `014_agent_health_check_url.sql` exists, so numbering is actually sequential. No issue -- just verified.

---

## Edge Cases Found by Scout

1. **Tab focus detection via `document.hidden`**: Correctly uses the Page Visibility API. Edge case: browser picture-in-picture or split-screen where tab is technically visible but user attention is elsewhere. Acceptable limitation.

2. **BroadcastChannel unavailability**: Properly guarded with `typeof BroadcastChannel === "undefined"` (line 38). Falls back gracefully -- each tab independently plays sounds with debounce limiting noise.

3. **Audio autoplay restrictions**: `.play().catch(() => {})` silently handles blocked autoplay (line 59). First interaction unlocks audio in most browsers. The permission request in the toggle handler (line 27-29) helps but doesn't guarantee audio unlock. Consider adding a user gesture requirement note in UI.

4. **Conversation not in local list**: Messages for conversations not yet in `conversationsRef.current` are dropped (line 99). This prevents notifications for conversations the user hasn't loaded yet -- correct behavior for MVP.

5. **Supabase channel name collision**: `"global-notification-listener"` is a fixed channel name. If two `useNotificationSound` hooks mount simultaneously (shouldn't happen with current architecture, but defensive coding would use a unique suffix).

---

## Positive Observations

- **Ref-based state for callbacks**: Using `conversationsRef` to avoid stale closures in the realtime callback is the correct React pattern
- **Cleanup discipline**: All three `useEffect` hooks have proper cleanup (unsubscribe, close channel, null audio ref)
- **Debounce over throttle**: 3s debounce is appropriate for notification sounds -- prevents annoying rapid-fire pings
- **Native notification tag**: Using a fixed tag (`agent-playground-notification`) collapses duplicate browser notifications
- **Graceful degradation**: Feature degrades cleanly when Notification API or BroadcastChannel unavailable
- **Small audio file**: 3.3KB MP3 is well-optimized
- **RLS protection**: The `users_update_self` policy already restricts updates to own row, preventing other users from toggling someone else's notifications

---

## Recommended Actions

1. **[H1]** Remove `notification_enabled` from `users_public` view -- privacy fix
2. **[H2]** Add cap/eviction to `handledMessageIds` set -- memory leak prevention
3. **[M3]** Add error toast on toggle failure -- UX polish
4. **[M4]** Sync `notificationEnabled` state with prop changes -- correctness
5. **[M1]** Improve mention matching with word boundaries -- when mention UX evolves
6. **[H3]** Document multi-tab race as accepted trade-off (already mitigated by debounce + notification tag)

---

## Metrics

- **Type Coverage:** 100% -- all parameters and return types annotated
- **Test Coverage:** N/A -- no tests included (per project convention)
- **Linting Issues:** 0 detected
- **Security Issues:** 1 (H1 -- privacy leak in public view)
- **Performance Issues:** 1 (H2 -- unbounded set growth)

---

## Unresolved Questions

1. Does `useCurrentUser` fetch from `users` table or `users_public` view? If view, removing `notification_enabled` from view requires changing the fetch source for current user.
2. Should notification sound respect "Do Not Disturb" or quiet hours? Not in requirements but worth considering for future.
3. Is there a plan to move to `@user_id`-based mentions instead of display name matching? Would eliminate M1 entirely.
