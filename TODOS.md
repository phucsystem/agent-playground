# TODOS

## Observability & Instrumentation
- [ ] Add Sentry performance monitoring (beyond error tracking)
- [ ] Implement webhook latency tracking in webhook_delivery_logs
- [ ] Basic usage analytics (MAU, conversation creation rate)
- [ ] Consider bundling with 0.2.0 Rate Limiting release
- **Why:** Success metrics in roadmap promise measurements that can't be taken today. Sentry is installed but only tracks errors.
- **Context:** Roadmap now tags metrics as "measurable today" vs "needs instrumentation". This TODO unblocks the "needs instrumentation" items.

## Update codebase-summary.md
- [ ] Add workspace components/hooks (workspace-rail, workspace-settings, use-workspaces, etc.)
- [ ] Add avatar upload components (avatar-editor-dialog, use-avatar-upload, crop-image)
- [ ] Add notification components (use-browser-notifications, presence-toast)
- [ ] Add health check components (use-agent-health, health check API route)
- [ ] Update directory structure tree
- [ ] Update file counts and hook/component totals
- **Why:** codebase-summary.md is the developer onboarding doc — currently missing 10+ files from shipped features.
- **Context:** Currently says "55+ files, 13 hooks, 25 components" but reality is significantly higher after workspace, avatar, notification, and health check features.
