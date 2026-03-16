# Phase 3: Admin UI — Webhook Config

## Context

- [UI_SPEC.md](../../docs/UI_SPEC.md) — S-06 Agent Webhook Config section
- [Prototype: Admin](../../prototypes/s06-admin.html)
- [SRD.md](../../docs/SRD.md) — FR-22, FR-26

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** 3h
- **Depends on:** Phase 1 (agent_configs table)

Update admin page to show webhook config fields when "Is agent?" is checked, and add webhook management actions on agent rows.

## Related Code Files

**Modify:**
- `/Users/phuc/Code/04-llms/agent-labs/src/app/admin/page.tsx` — Add webhook fields to invite form, agent row actions

**Create:**
- `/Users/phuc/Code/04-llms/agent-labs/src/hooks/use-agent-configs.ts` — CRUD hook for agent_configs table

## Implementation Steps

### Step 1: Create `use-agent-configs.ts` hook

```typescript
// Handles: fetch all configs, create, update, toggle, delete
// Admin-only — RLS enforces

export function useAgentConfigs() {
  const [configs, setConfigs] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchConfigs() { /* GET /rest/v1/agent_configs */ }
  async function createConfig(userId, webhookUrl, webhookSecret?) { /* POST */ }
  async function updateConfig(userId, updates) { /* PATCH */ }
  async function toggleWebhook(userId, isActive) { /* PATCH is_webhook_active */ }
  async function deleteConfig(userId) { /* DELETE */ }

  return { configs, loading, fetchConfigs, createConfig, updateConfig, toggleWebhook, deleteConfig };
}
```

### Step 2: Update admin invite form

In `admin/page.tsx`, add state:
```typescript
const [webhookUrl, setWebhookUrl] = useState("");
const [webhookSecret, setWebhookSecret] = useState("");
```

Show webhook fields conditionally when `inviteIsAgent` is true:
- Webhook URL input (required, type=url, placeholder: "https://your-agent.com/webhook")
- Webhook Secret input (optional, type=password, show/hide toggle)
- Info text: "Used for HMAC-SHA256 signature verification"

Update `handleCreateInvite`:
1. Create user (existing flow)
2. If `inviteIsAgent && webhookUrl`: create agent_configs row via `createConfig(newUserId, webhookUrl, webhookSecret)`

### Step 3: Update user list — agent row actions

For users where `is_agent === true`, check if they have a config in `configs` map.

Add actions:
- **Webhook indicator**: Green dot (active) / grey dot (paused) / no dot (no config) next to status badge
- **Edit Webhook** button: Opens inline form to edit URL + secret
- **Toggle Webhook** button: Calls `toggleWebhook(userId, !currentState)`
- **View Logs** link: Navigates to `/admin/webhooks?agent={userId}`

### Step 4: Inline webhook edit form

When "Edit Webhook" clicked on agent row:
- Show inline card below the row (or modal) with:
  - Webhook URL input (pre-filled)
  - Webhook Secret input (masked, with reveal toggle)
  - Save / Cancel buttons
- On Save: call `updateConfig(userId, { webhook_url, webhook_secret })`

## Todo

- [x] Create `src/hooks/use-agent-configs.ts`
- [x] Add webhook URL + secret fields to invite form (conditional on is_agent)
- [x] Create agent_configs record after user creation
- [x] Add webhook status indicator to agent rows
- [x] Add Edit Webhook / Toggle / View Logs actions
- [x] Implement inline edit form for webhook config

## Success Criteria

- Admin can create agent with webhook URL in one flow
- Webhook indicator shows on agent rows
- Toggle webhook on/off works without removing config
- Edit webhook URL/secret works
- View Logs navigates to S-08

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Admin page already 294 LOC | May exceed 200 LOC limit | Extract webhook-specific components: `AgentWebhookForm`, `AgentRowActions` |
| Webhook URL validation | User enters HTTP (not HTTPS) | Client-side validation + DB CHECK constraint catches it |
