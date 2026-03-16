---
phase: 1
priority: high
status: completed
effort: S
---

# Phase 1: Install Sonner + Add Toaster

## Overview

Install sonner and mount `<Toaster />` in the chat layout.

## Implementation Steps

### 1. Install sonner

```bash
pnpm add sonner
```

### 2. Add `<Toaster />` to chat layout

In `src/app/chat/layout.tsx`, add after the closing `</div>` of the flex container but before the fragment end:

```typescript
import { Toaster } from "sonner";

// Inside the return, after CreateGroupDialog:
<Toaster
  position="top-right"
  visibleToasts={3}
  toastOptions={{
    duration: 3000,
    className: "!bg-white !border-neutral-200 !shadow-lg",
  }}
/>
```

## Todo

- [ ] Install sonner
- [ ] Add Toaster to layout.tsx
- [ ] Verify renders without errors
