# Phase 4: Admin UI (Health URL Config)

**Priority:** Medium
**Status:** completed
**Effort:** S (Small)
**Depends on:** Phase 1

## Overview

Add optional "Health Check URL" field to the webhook config form in admin panel. Admin can set/update per agent.

## Related Files

**Modify:**
- `src/components/admin/webhook-config-form.tsx` — add health URL input
- `src/hooks/use-agent-configs.ts` — include `health_check_url` in select + createConfig/updateConfig

## Implementation Steps

### 1. Update Webhook Config Form

Add a new input field after webhook secret:

```
Health Check URL (optional)
┌───────────────────────────────────┐
│ https://my-agent.com/health       │
└───────────────────────────────────┘
ℹ GET endpoint returning 200 = healthy
```

**Props to add:**
- `healthCheckUrl: string`
- `onHealthCheckUrlChange: (url: string) => void`

### 2. Update Agent Configs Hook

In `use-agent-configs.ts`:
- Add `health_check_url` to the `.select()` query
- Add `health_check_url` param to `createConfig()`
- Add `health_check_url` to `updateConfig()` accepted fields

### 3. Wire in Admin Page

Admin page already uses `WebhookConfigForm` — update the state + handlers to include the new field.

## Todo

- [x] Add `healthCheckUrl` prop + input to `webhook-config-form.tsx`
- [x] Update `use-agent-configs.ts` select/create/update
- [x] Wire in admin page state management
- [x] Compile check

## Success Criteria

- Admin can set health check URL when creating agent
- Admin can edit health check URL for existing agent
- URL validated as HTTPS (browser + DB constraint)
- Empty URL saved as null (not empty string)
