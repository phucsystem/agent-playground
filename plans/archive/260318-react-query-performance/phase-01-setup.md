# Phase 1: Setup & Splash Fix

## Overview
- **Priority:** Critical (blocks all other phases)
- **Status:** Completed
- **Effort:** 0.5h

Install TanStack Query v5, create QueryClient singleton, wire into root layout, and remove the hardcoded 2s splash timer.

## Key Insights

- Root layout (`src/app/layout.tsx`) is a server component -- QueryClientProvider must go in a client wrapper
- Chat layout has a `splashDone` state with `setTimeout(2000)` that blocks rendering even after data is ready
- The splash was likely added to mask loading flicker -- React Query cache eliminates that need

## Requirements

### Functional
- FR-1: App renders with QueryClientProvider wrapping all client components
- FR-2: Chat layout no longer shows 2s forced splash screen
- FR-3: Chat layout still shows loading state while `useCurrentUser` resolves (but no artificial delay)

### Non-Functional
- NFR-1: QueryClient configured with sensible defaults (staleTime 60s, gcTime 30min, retry 1)
- NFR-2: DevTools available in development only

## Architecture

```
RootLayout (server)
  └── QueryProvider (client wrapper)
        └── QueryClientProvider
              └── ReactQueryDevtools (dev only)
                    └── {children}
```

## Related Code Files

### Files to Create
- `src/lib/query-client.ts` -- QueryClient singleton + config
- `src/app/query-provider.tsx` -- Client component wrapper for QueryClientProvider

### Files to Modify
- `src/app/layout.tsx` -- Wrap children in QueryProvider
- `src/app/chat/layout.tsx` -- Remove `splashDone` state and 2s timeout
- `package.json` -- Add @tanstack/react-query@5 + devtools

## Implementation Steps

### 1. Install dependencies
```bash
npm install @tanstack/react-query@5 @tanstack/react-query-devtools@5
```

### 2. Create `src/lib/query-client.ts`
```ts
import { QueryClient } from "@tanstack/react-query";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 30 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}
```

Use factory function pattern (not singleton) because Next.js SSR can share singletons across requests. The provider will call this once per client mount.

### 3. Create `src/app/query-provider.tsx`
```tsx
"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createQueryClient } from "@/lib/query-client";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### 4. Update `src/app/layout.tsx`
Wrap `{children}` in `<QueryProvider>`:
```tsx
import { QueryProvider } from "./query-provider";
// ...
<body suppressHydrationWarning>
  <QueryProvider>{children}</QueryProvider>
</body>
```

### 5. Remove splash timer from `src/app/chat/layout.tsx`

In `ChatLayoutInner`:
- DELETE the `splashDone` state: `const [splashDone, setSplashDone] = useState(false);`
- DELETE the useEffect with setTimeout
- CHANGE guard from `if (userLoading || !splashDone)` to just `if (userLoading)`

Before:
```tsx
const [splashDone, setSplashDone] = useState(false);
useEffect(() => {
  const timer = setTimeout(() => setSplashDone(true), 2000);
  return () => clearTimeout(timer);
}, []);

if (userLoading || !splashDone) {
```

After:
```tsx
if (userLoading) {
```

### 6. Verify build compiles
```bash
npm run build
```

## Todo List

- [x] Install @tanstack/react-query@5 and devtools
- [x] Create `src/lib/query-client.ts`
- [x] Create `src/app/query-provider.tsx`
- [x] Update `src/app/layout.tsx` with QueryProvider
- [x] Remove splash timer from `src/app/chat/layout.tsx`
- [x] Verify build compiles

## Success Criteria

- App loads without 2s artificial delay
- QueryClientProvider wraps all routes
- DevTools panel visible in dev mode
- No regressions in existing functionality

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| SSR singleton leak | QueryClient shared across requests in SSR | Use factory function `useState(() => createQueryClient())` |
| Splash removal reveals loading flicker | Users see brief loading state | Phase 4 skeleton screens address this; acceptable intermediate state |
