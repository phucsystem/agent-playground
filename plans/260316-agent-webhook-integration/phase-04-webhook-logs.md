# Phase 4: Webhook Logs Page

## Context

- [UI_SPEC.md](../../docs/UI_SPEC.md) — S-08 Webhook Logs
- [Prototype: Webhook Logs](../../prototypes/s08-webhook-logs.html)
- [SRD.md](../../docs/SRD.md) — FR-25

## Overview

- **Priority:** P2
- **Status:** Pending
- **Effort:** 2h
- **Depends on:** Phase 1 (webhook_delivery_logs table)

Admin-only page at `/admin/webhooks` showing webhook delivery history with filtering.

## Related Code Files

**Create:**
- `/Users/phuc/Code/04-llms/agent-labs/src/app/admin/webhooks/page.tsx` — Webhook logs page
- `/Users/phuc/Code/04-llms/agent-labs/src/hooks/use-webhook-logs.ts` — Fetch + filter hook

## Implementation Steps

### Step 1: Create `use-webhook-logs.ts` hook

```typescript
interface WebhookLogFilters {
  agentId?: string;
  status?: DeliveryStatus;
  timeRange: "1h" | "24h" | "7d";
}

export function useWebhookLogs(filters: WebhookLogFilters) {
  // Fetch from webhook_delivery_logs with joins:
  // - agent:users(id, display_name, avatar_url)
  // - message:messages(id, content, sender_id)
  // Apply filters: agent_id, status, created_at >= threshold
  // Order: created_at DESC, limit 50, paginated
  // Returns: { logs, loading, hasMore, loadMore }
}
```

### Step 2: Create `/admin/webhooks/page.tsx`

Layout (matching prototype s08-webhook-logs.html):

1. **Header**: "Webhook Delivery Logs" + Back link to /admin + Auto-refresh toggle
2. **Filters row**: Agent dropdown, Status dropdown, Time range dropdown
3. **Table**: Time, Agent (avatar + name), Message (truncated), Status badge, Latency
4. **Expandable rows**: Click row → show full payload, webhook URL, response details
5. **Retry sub-rows**: Indented rows showing retry attempts
6. **Pagination**: "Showing X of Y entries" + "Load more" button

Components breakdown:
- `WebhookLogRow` — Single log entry with expand/collapse
- `WebhookLogDetail` — Expanded view with full info
- `WebhookRetryRow` — Sub-row for retry attempts
- `WebhookFilters` — Filter dropdowns

### Step 3: Fetch agent list for filter dropdown

```typescript
// Reuse from admin page or fetch separately
const { data: agents } = await supabase
  .from("users")
  .select("id, display_name")
  .eq("is_agent", true);
```

### Step 4: Status badges

| Status | Badge | Color |
|--------|-------|-------|
| delivered | `✓ {httpStatus}` | Green (text-success) |
| failed | `✗ {httpStatus or "timeout"}` | Red (text-error) |
| pending | `⏳ pending` | Yellow (text-warning) |

### Step 5: Auto-refresh (optional)

Toggle checkbox → poll every 10s via `setInterval` calling `fetchLogs()`.

## Todo

- [x] Create `src/hooks/use-webhook-logs.ts`
- [x] Create `src/app/admin/webhooks/page.tsx`
- [x] Implement filter dropdowns (agent, status, time range)
- [x] Implement expandable log rows
- [x] Implement retry sub-rows
- [x] Add pagination (load more)
- [x] Add auto-refresh toggle

## Success Criteria

- Page loads at `/admin/webhooks` (admin only)
- Filters work: by agent, status, time range
- Rows expand to show full webhook details
- Retry sub-rows appear for multi-attempt deliveries
- Pagination works
- Non-admin users see "Access denied"

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large log volume slows queries | Low for <50 users | Index on (agent_id, created_at DESC) handles it |
| Auto-refresh causes excessive queries | Low | 10s interval is fine for admin debugging |
