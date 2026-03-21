# TODOS

## Observability & Instrumentation
- [ ] Add Sentry performance monitoring (beyond error tracking)
- [ ] Implement webhook latency tracking in webhook_delivery_logs (includes GoClaw bridge hop — bridge logs latency internally but delivery_logs lack end-to-end timing)
- [ ] Basic usage analytics (MAU, conversation creation rate)
- [ ] Consider bundling with 0.2.0 Rate Limiting release
- **Why:** Success metrics in roadmap promise measurements that can't be taken today. Sentry is installed but only tracks errors. GoClaw bridge adds an extra hop that's only visible in console logs, not in delivery_logs.
- **Context:** Roadmap now tags metrics as "measurable today" vs "needs instrumentation". This TODO unblocks the "needs instrumentation" items.

## GoClaw WebSocket Streaming (Phase 2)
- [ ] Replace REST bridge with WebSocket connection to GoClaw's `chat.stream` method
- [ ] Implement streaming message insertion (progressive token display in chat UI)
- [ ] Add streaming state management (partial message, typing indicator, abort)
- [ ] Support GoClaw's 64 WebSocket RPC methods for full agent lifecycle control
- **Why:** Current REST bridge waits for full LLM response before displaying — can be 5-30s of blank screen. WebSocket streaming shows tokens in real-time.
- **Context:** Depends on GoClaw webhook bridge (Phase 1) shipping first. Effort: L (human) / M (CC). Priority: P3. Reference: `plans/reports/researcher-260320-goclaw-integration.md` (Option B: WebSocket RPC).

## Update codebase-summary.md
- [ ] Add workspace components/hooks (workspace-rail, workspace-settings, use-workspaces, etc.)
- [ ] Add avatar upload components (avatar-editor-dialog, use-avatar-upload, crop-image)
- [ ] Add notification components (use-browser-notifications, presence-toast)
- [ ] Add health check components (use-agent-health, health check API route)
- [ ] Update directory structure tree
- [ ] Update file counts and hook/component totals
- **Why:** codebase-summary.md is the developer onboarding doc — currently missing 10+ files from shipped features.
- **Context:** Currently says "55+ files, 13 hooks, 25 components" but reality is significantly higher after workspace, avatar, notification, and health check features.

## Sync IPA docs with shipped features (/ipa-docs:sync)
- [ ] **SRD.md** — Add FR-33+ for workspaces, multi-session, avatar upload, health checks, notifications, clipboard paste, admin delete
- [ ] **DB_DESIGN.md** — Add workspaces table, workspace_members table, user_sessions table, avatars storage bucket, notification preferences columns
- [ ] **API_SPEC.md** — Add workspace CRUD endpoints, workspace member management, avatar upload, health check API route, notification settings
- [ ] **UI_SPEC.md** — Add S-09 workspace rail, avatar upload dialog, notification toggle, health check status dot, workspace settings screen
- **Why:** All 4 IPA docs are stale — missing 10+ features shipped post-MVP. They are the authoritative specs that implementation plans reference.
- **Context:** Run `/ipa-docs:sync` in a dedicated session. Estimated ~1000 lines of changes across 4 files.
