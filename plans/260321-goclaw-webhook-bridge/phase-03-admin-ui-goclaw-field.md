# Phase 3: Admin UI — GoClaw Agent Key Field

## Context
- [WebhookConfigForm](../../src/components/admin/webhook-config-form.tsx) — existing form (87 lines)
- [use-agent-configs hook](../../src/hooks/use-agent-configs.ts) — CRUD operations
- [Admin page](../../src/app/admin/page.tsx) — InlineWebhookEditor dialog
- [database.ts](../../src/types/database.ts) — AgentConfig type

## Overview
- **Priority:** P2
- **Status:** complete
- **Effort:** 1.5h (updated — includes design review additions)

## Requirements
- Add optional "GoClaw Agent Key" input to webhook config form
- Store value in `agent_configs.metadata.goclaw_agent_key`
- Show field in both create-agent flow and edit-webhook dialog
- Auto-fill webhook_url and health_check_url when GoClaw key is entered
- "Test Connection" button in edit modal only (not create form)
- Read/write metadata through existing hook

## Design Specifications (from design review)

### Field Ordering
GoClaw Agent Key field appears BEFORE webhook URL and health check URL fields.
Rationale: entering the key auto-fills those URLs, so it must come first in the flow.

```
Create Agent Form / Edit Modal:
┌──────────────────────────────────┐
│ GoClaw Agent Key  (optional)     │  ← NEW, first
│ [playground-assistant          ] │
│ (puzzle-icon) Maps to GoClaw     │
│                   agent config   │
├──────────────────────────────────┤
│ Webhook URL *                    │  ← auto-filled when key entered
│ [https://app.com/api/goclaw/b...│
│ (auto) Auto-filled from GoClaw   │
│                          key     │
├──────────────────────────────────┤
│ Webhook Secret                   │
│ [whsec_...                     ] │
│ (i) Sent as Bearer token         │
├──────────────────────────────────┤
│ Health Check URL  (optional)     │  ← auto-filled when key entered
│ [https://goclaw.server.com/hea..│
│ (heart) Auto-filled from GoClaw  │
│                          key     │
├──────────────────────────────────┤
│ [Test Connection]                │  ← edit modal ONLY
│ (check) Connected! (142ms)       │
└──────────────────────────────────┘
```

### GoClaw Agent Key Field
- **Label:** "GoClaw Agent Key" with `(optional)` suffix in neutral-400
- **Input:** Same styling as other fields: `px-3 py-2 text-sm border border-neutral-200 rounded-lg font-mono`
- **Placeholder:** `"e.g. playground-assistant"`
- **Helper text:** Lucide `Puzzle` icon (w-3 h-3) + "Maps this agent to a GoClaw agent (from GoClaw config)"
- **Validation:** alphanumeric + hyphens + underscores only (matches GoClaw's `[a-zA-Z0-9_-]` pattern)

### Auto-fill Behavior
When user types/changes the GoClaw agent key:
1. If webhook_url is empty OR was previously auto-filled → set to `${window.location.origin}/api/goclaw/bridge`
2. If health_check_url is empty OR was previously auto-filled → set to `${NEXT_PUBLIC_GOCLAW_URL || ''}/health`
3. Auto-filled fields get a brief `bg-primary-50` flash (1s transition)
4. Helper text below auto-filled fields shows: "Auto-filled from GoClaw key"
5. If user manually edits an auto-filled field → helper text disappears, field marked as manually set
6. Subsequent GoClaw key changes do NOT overwrite manually-edited fields

**Track auto-fill state:** Use a local `autoFilledFields` set to distinguish auto-filled vs manual.

### Test Connection Button (edit modal only)
- **Placement:** After all fields, before Save/Cancel buttons
- **Style:** Secondary button: `border border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-lg px-3 py-2 text-sm`
- **Only visible when:** `goclaw_agent_key` is set (non-empty)
- **Behavior:** Calls GoClaw `/health` endpoint via a new lightweight API route or direct fetch

**Interaction states:**

| State | Button Text | Below Button |
|-------|-------------|-------------|
| Idle | `[Zap icon] Test Connection` | (nothing) |
| Loading | `[Spinner] Testing...` (disabled) | (nothing) |
| Success | `[Zap icon] Test Connection` | `(green CheckCircle) Connected! ({latency}ms)` — fades after 5s |
| Error | `[Zap icon] Test Connection` | `(red XCircle) Connection failed: {error}` — stays until next test |

- Success text: `text-xs text-green-600`
- Error text: `text-xs text-red-500`
- Use existing Lucide icons: `Zap`, `Loader2` (animate-spin), `CheckCircle`, `XCircle`

### Test Connection API
The test button needs to check GoClaw connectivity. Two options:
- **Option A:** Direct fetch from browser to GoClaw health endpoint (CORS may block)
- **Option B:** Call a Next.js API route that proxies the health check (no CORS issues)

**Use Option B** — create `/api/goclaw/test` route that fetches `GOCLAW_URL/health` server-side and returns status.

## Related Code Files
- **Update:** `src/types/database.ts` — Add `metadata` to AgentConfig interface
- **Update:** `src/hooks/use-agent-configs.ts` — Include metadata in select/create/update
- **Update:** `src/components/admin/webhook-config-form.tsx` — Add GoClaw agent key input + auto-fill
- **Update:** `src/app/admin/page.tsx` — Pass metadata through create flow + InlineWebhookEditor + Test Connection
- **Create:** `src/app/api/goclaw/test/route.ts` — Test connection proxy endpoint

## Implementation Steps

### 1. Update AgentConfig type (`src/types/database.ts`)

Add `metadata` field:
```typescript
export interface AgentConfig {
  // ... existing fields
  metadata: Record<string, unknown> | null;
}
```

### 2. Update use-agent-configs hook (`src/hooks/use-agent-configs.ts`)

- Add `metadata` to the select query
- Add `metadata` parameter to `createConfig`
- Add `metadata` to `updateConfig` updates type

### 3. Create test connection route (`src/app/api/goclaw/test/route.ts`)

Lightweight proxy: fetches `GOCLAW_URL/health`, returns `{ok: boolean, latencyMs: number, error?: string}`.
Auth: requires authenticated user (same pattern as health route). Timeout: 5s.

### 4. Update WebhookConfigForm (`src/components/admin/webhook-config-form.tsx`)

- Add GoClaw Agent Key field BEFORE webhook URL
- Add auto-fill logic with `autoFilledFields` tracking
- Add `bg-primary-50` flash animation on auto-fill
- Add "Auto-filled from GoClaw key" helper text

### 5. Update Admin page — Create agent flow (`src/app/admin/page.tsx`)

- Add `goclawAgentKey` state variable
- Pass to WebhookConfigForm
- On create: include in metadata `{goclaw_agent_key: goclawAgentKey}` if non-empty
- Reset in `resetInviteForm`

### 6. Update Admin page — InlineWebhookEditor (`src/app/admin/page.tsx`)

- Read initial goclawAgentKey from `config.metadata?.goclaw_agent_key`
- Add GoClaw Agent Key field with auto-fill
- Add Test Connection button with inline status feedback
- On save: merge goclawAgentKey into metadata update

## Todo
- [x] Add `metadata` to AgentConfig interface in database.ts
- [x] Update use-agent-configs.ts — select, create, update to handle metadata
- [x] Create `/api/goclaw/test` route for connection testing
- [x] Add GoClaw agent key input to WebhookConfigForm (before URL fields)
- [x] Implement auto-fill with flash animation and helper text
- [x] Add Test Connection button to InlineWebhookEditor (edit only)
- [x] Implement inline test status feedback (loading/success/error)
- [x] Wire up create-agent flow in admin page
- [x] Wire up InlineWebhookEditor in admin page

## Success Criteria
- GoClaw Agent Key field appears before URL fields in both create and edit
- Auto-fill populates webhook_url and health_check_url with flash feedback
- Manual URL edits are preserved when key changes
- Test Connection button visible only when GoClaw key is set
- Test shows inline loading → success (with latency) or error
- Value persisted to `agent_configs.metadata.goclaw_agent_key`
- Empty field = no goclaw integration (backward compatible)
- Existing agents unaffected (metadata defaults to `{}`)
