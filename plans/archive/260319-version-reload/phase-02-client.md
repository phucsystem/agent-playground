# Phase 2: Client Hook + Banner Component + Layout Integration

## Context
- [Phase 1 — backend](./phase-01-backend.md)
- [Existing realtime hook pattern](../../src/hooks/use-realtime-messages.ts) — channel subscribe/unsubscribe pattern
- [Chat layout](../../src/app/chat/layout.tsx) — where banner will be rendered
- [Toast component pattern](../../src/components/ui/agent-health-toast.tsx) — styling reference

## Overview
- **Priority:** P2
- **Status:** pending
- **Effort:** ~1h

## Key Insights
- All existing hooks use `createBrowserSupabaseClient()` from `@/lib/supabase/client` — follow same pattern
- Supabase broadcast channels don't require auth — anon key is sufficient for subscribing
- Banner should be rendered above the main content area in the chat layout, not as a toast (toasts auto-dismiss)
- Use `usePathname()` to detect route changes and re-show dismissed banner

## Implementation Steps

### 1. Create `useVersionCheck` hook (~55 lines)

**File:** `src/hooks/use-version-check.ts` (create)

```ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const BUILD_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown";

export function useVersionCheck() {
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const handleNewVersion = useCallback((version: string) => {
    if (version !== BUILD_VERSION && version !== "unknown") {
      setNewVersion(version);
      setDismissed(false); // Re-show if previously dismissed
    }
  }, []);

  // Supabase realtime broadcast subscription
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("app-releases")
      .on("broadcast", { event: "new-version" }, (payload) => {
        const version = payload.payload?.version;
        if (version) handleNewVersion(version);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [handleNewVersion]);

  // Polling fallback
  useEffect(() => {
    const poll = async () => {
      try {
        const response = await fetch("/api/version");
        if (response.ok) {
          const data = await response.json();
          if (data.version) handleNewVersion(data.version);
        }
      } catch {
        // Silently ignore — network issues shouldn't break the app
      }
    };

    const intervalId = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [handleNewVersion]);

  const dismiss = useCallback(() => setDismissed(true), []);
  const reload = useCallback(() => window.location.reload(), []);

  const showBanner = newVersion !== null && !dismissed;

  return { showBanner, newVersion, dismiss, reload };
}
```

**Design decisions:**
- No initial poll on mount — only after 5min. Realtime handles instant detection.
- `dismissed` resets when a NEW broadcast arrives (edge case: two releases in quick succession)
- `BUILD_VERSION` read once at module level — stable for the page lifetime

### 2. Create `<UpdateBanner />` component (~40 lines)

**File:** `src/components/ui/update-banner.tsx` (create)

Persistent top banner matching the app's design language (muted colors, clean):

```tsx
"use client";

import { RefreshCw, X } from "lucide-react";

interface UpdateBannerProps {
  version: string;
  onReload: () => void;
  onDismiss: () => void;
}

export function UpdateBanner({ version, onReload, onDismiss }: UpdateBannerProps) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-primary-50 border-b border-primary-200 text-primary-800 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <RefreshCw className="w-4 h-4 shrink-0" />
        <span className="truncate">
          A new version ({version}) is available.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onReload}
          className="px-3 py-1 rounded-md bg-primary-600 text-white text-xs font-medium hover:bg-primary-700 transition-colors cursor-pointer"
        >
          Refresh
        </button>
        <button
          onClick={onDismiss}
          className="p-1 rounded-md hover:bg-primary-100 transition-colors cursor-pointer"
          aria-label="Dismiss update notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
```

**Styling notes:**
- Uses existing `primary-*` color tokens (consistent with workspace rail, buttons)
- Muted, eye-friendly — per user preference
- `lucide-react` icons already in dependencies
- No animation/flash — just a static bar

### 3. Integrate into chat layout (~8 lines changed)

**File:** `src/app/chat/layout.tsx` (modify)

Add hook + banner in `ChatLayoutContent`:

```diff
+ import { useVersionCheck } from "@/hooks/use-version-check";
+ import { UpdateBanner } from "@/components/ui/update-banner";

  function ChatLayoutContent({ children, currentUser, onRefreshUser }: ...) {
+   const { showBanner, newVersion, dismiss, reload } = useVersionCheck();
    // ... existing code ...

    return (
      <div className="flex h-dvh">
+       {showBanner && newVersion && (
+         <div className="fixed top-0 left-0 right-0 z-[60]">
+           <UpdateBanner version={newVersion} onReload={reload} onDismiss={dismiss} />
+         </div>
+       )}
        {/* Mobile sidebar overlay backdrop */}
        // ... rest unchanged
```

**Placement:** Fixed top banner with high z-index (above sidebar z-50). This ensures visibility regardless of scroll position. The banner is thin (~36px) so minimal disruption.

**Alternative:** Render inline above the flex container. But fixed is better — always visible even when scrolled deep in a conversation.

### 4. Re-show banner on route change (built-in)

The `useVersionCheck` hook resets `dismissed` when a new broadcast arrives. For route-change re-show, we can optionally add:

```ts
// In useVersionCheck, add usePathname dependency
import { usePathname } from "next/navigation";

const pathname = usePathname();

useEffect(() => {
  if (newVersion) setDismissed(false);
}, [pathname]); // Re-show on navigation
```

This is optional — if user dismissed it, showing again on every navigation may be annoying. **Recommendation:** Skip this for v1. User can always reload manually. If feedback says users miss updates, add it later (YAGNI).

## TODO

- [ ] Create `src/hooks/use-version-check.ts`
- [ ] Create `src/components/ui/update-banner.tsx`
- [ ] Import and render in `src/app/chat/layout.tsx`
- [ ] Verify typecheck passes (`pnpm exec tsc --noEmit`)
- [ ] Manual test: open browser, broadcast a message to `app-releases` channel, verify banner appears

## Success Criteria
- Banner appears when Supabase broadcast received with newer version
- Banner appears when polling detects version mismatch
- "Refresh" button reloads the page
- "X" button dismisses the banner
- Banner does not appear if versions match
- No console errors, typecheck passes

## Security Considerations
- No sensitive data exposed — version string only
- Broadcast channel is public (by design — Supabase broadcast doesn't require auth)
- Polling endpoint is public GET (version is not sensitive)

## Related Code Files
- Create: `src/hooks/use-version-check.ts`
- Create: `src/components/ui/update-banner.tsx`
- Modify: `src/app/chat/layout.tsx`
