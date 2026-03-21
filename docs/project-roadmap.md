# Project Roadmap

**Last Updated:** 2026-03-21
**Current Version:** 1.4.0
**Status:** MVP + GoClaw integration complete

## Release Timeline

### ✅ 1.4.0 — GoClaw Integration (Current)

**Released:** 2026-03-21

**Phase 7 — GoClaw Webhook Bridge:**
- GoClaw agent integration via `/api/goclaw/bridge` (webhook-callable bridge)
- Bearer token authentication with timing-safe comparison
- System prompt composition for DM vs group context
- History mapping to OpenAI format (text-only messages)
- SSRF protection (blocks internal IPs, .local/.internal domains, metadata endpoints)
- Structured logging with latency, token counts, no secrets
- Health check proxy at `/api/goclaw/test` for UI validation
- Agent metadata config: `agent_configs.metadata.goclaw_agent_key`
- Custom/GoClaw agent mode toggle in admin webhook config form
- GoClaw-mode fields auto-fill and lock (webhook URL, secret, health check)
- Database migration 023: Added metadata JSONB column to agent_configs

### ✅ 1.3.1 — React Query Performance & Sidebar Realtime

**Released:** 2026-03-18

**Latest Enhancements:**
- React Query v5 migration with localStorage persister (24h TTL conversations)
- Sidebar realtime sync: 6 subscription channels per conversation (messages INSERT, CRUD, members, reactions, typing, presence)
- Message read fixes and cache invalidation logic
- Surgical cache updates via setQueryData (no full refetch)

**Core Stack:** Phases 1-5 Complete + Phase 6 Enhancements:
- P1: Core chat (auth, DMs, groups, realtime)
- P2: Rich content (files, images, URLs, markdown)
- P3: Polish (typing indicators, reactions)
- P4: Admin (user management, setup wizard, mock flag)
- P5: Agent webhooks (dispatch, delivery logs, @mention routing, thinking indicator)
- P6: Mobile + workspace + agent health + notifications

**Previous Releases:**
- v1.3.0 (2026-03-17) — Chat UI polish, snippet cards, sidebar search
- v1.3.0 — Initial release with chat, workspaces, agent health

**Post-Phase 6 Enhancements:**

Release Management:
- Changelog page at `/changelog` — GitHub release notes display with ISR revalidation
- Version badge in sidebar footer links to changelog for easy release discovery
- Build-time static fetch from GitHub API ensures no extra API calls at runtime

Mobile & Presence:
- Mobile responsive layout (sm/md/lg breakpoints)
- Hamburger sidebar toggle for mobile
- Conversation pinning (localStorage-based)
- Online/offline presence toasts (Sonner notifications)
- Conversation history in webhook payloads
- Group archive functionality
- @mention autocomplete in group messages

Agent Experience:
- Agent health checks with status dot and toast notifications
- Typewriter animation for agent messages (40ms/char)
- Agent-specific avatar styles when editing profiles

User Experience:
- Multi-session support with 3-session cap
- Browser notifications with sound for DMs and @mentions
- Avatar upload with circle crop (react-easy-crop) + DiceBear generation
- Clipboard image paste and multi-file attachment support

Admin:
- Admin conversation deletion with file cleanup
- Sentry error tracking and monitoring

Workspace:
- Multi-workspace support with Discord-style icon rail switcher
- Workspace avatar with deterministic color from ID
- Workspace color picker and settings UX

**Technology Stack:**
- Next.js 16, React 19, TypeScript 5.9
- React Query v5 (TanStack) with localStorage persister
- Tailwind CSS 4.2
- Supabase (PostgreSQL, Realtime, Auth, Storage, Edge Functions)
- Markdown: react-markdown + remark-gfm + rehype-highlight
- UI: Lucide icons, Sonner toasts, TanStack React Virtual, DnD Kit
- Monitoring: Sentry 10.43.0

See `docs/codebase-summary.md` for current file counts and project structure.

---

### 🎯 0.2.0 — Rate Limiting & Security Hardening (Planned Q2 2026)

**Effort:** S (small)
**Priority:** High (security prerequisite for any public-facing feature)

**Features:**
- Per-user/per-agent request throttling
- Webhook rate limits
- API abuse prevention

**Rationale:**
- Blocks marketplace launch — current system has no protection against DoS
- Required before any public-facing release

---

### 🎯 0.3.0 — Message Management (Planned Q2 2026)

**Effort:** M (medium)
**Priority:** Medium-High (compliance)

**Features:**
- Edit messages (with audit trail "edited")
- Delete messages (soft delete)
- Message retention policies
- Admin audit log viewing

**Rationale:**
- Comply with data governance policies
- Allow correction of mistakes
- Enable compliance audits

---

### 🎯 0.4.0 — Search & Discovery (Planned Q2-Q3 2026)

**Effort:** M (medium)
**Priority:** Medium (user feedback driven)

**Features:**
- Full-text message search across conversations
- Filter by sender, date range, content type
- Search results with context snippet
- Indexed search (PostgreSQL full-text or Meilisearch)

**Rationale:**
- Users want to find old conversations quickly
- Essential for 10+ agent workflows

---

### 🎯 0.5.0 — User Controls (Planned Q3 2026)

**Effort:** S (small)
**Priority:** Medium

**Features:**
- User blocking (prevent messages from blocked users)
- Mute conversations (hide from sidebar, no notifications)
- Delete conversation (soft delete, archive)
- Privacy settings per conversation

**Rationale:**
- Reduces noise in multi-user setups
- Better control over collaboration scope

---

### 🎯 0.6.0 — Public Agent Marketplace (Planned Q3 2026)

**Effort:** L (large)
**Priority:** High (growth)

**Features:**
- Agent registry (searchable catalog)
- Agent preview (test before adding to workspace)
- Agent ratings + reviews
- One-click agent add to workspace
- Agent versioning

**Architecture:**
- Separate `public_agents` table
- Agent metadata schema (description, avatar, tags)
- Preview conversation isolated from main workspace
- Agent stats: usage count, uptime, avg response time
- `workspace_id` FK needed on agent marketplace installs
- Agents installed from marketplace scoped to specific workspace
- `agent_configs` may need workspace_id column
- Depends on existing workspace infrastructure

**Rationale:**
- Enable marketplace ecosystem
- Reduce friction for new users to try agents
- Build community around platform

---

### 🎯 0.7.0 — Tool Marketplace (Planned Q4 2026)

**Effort:** XL (extra large)
**Priority:** Medium-High (extensibility)

**Features:**
- Pre-built integrations (Zapier, Make, n8n, Slack, etc.)
- Tool configuration UI per workspace
- Tool marketplace with ratings
- Action triggers (archive conversation → Zapier)

**Architecture:**
- `integrations` table (per-workspace config)
- Edge Function handlers for tool triggers
- OAuth for SaaS integrations

**Rationale:**
- Extend beyond chat → workflow automation
- Reduce need for custom agents

---

## Backlog

### Deferred (Considered, descoped with rationale)

- **Analytics Dashboard** — Deferred until observability infrastructure exists
- **Conversation Summaries** — Deferred until search is built (overlapping effort)
- **A/B Testing** — Deferred until marketplace provides agent variety to test
- **Scheduled Messages** — Low demand, revisit based on feedback

### Speculative (No timeline, genuinely future)

- **Voice/Video Calls** — Requires Livekit/Daily.co integration
- **CMS Integration** — Knowledge base agents
- **End-to-End Encryption** — Significant architecture change
- **Agent-to-Agent Communication** — Open design question
- **Mobile Native (React Native)** — If web proves insufficient
- **Desktop App (Electron)** — If demand exists
- **GraphQL API** — Alternative to REST
- **Multi-Language (i18n)** — International expansion

---

## Prioritization Framework

**High Priority:**
- Fixes blocking real-world usage
- Feature requests from 3+ users
- Security/compliance requirements

**Medium Priority:**
- Nice-to-have improvements
- Feedback from 1-2 users
- Bulk operations, admin tools

**Low Priority:**
- Future extensibility
- Architecture cleanup
- Documentation updates

---

## Success Metrics

| Metric | Target | Measurable Today? | Source |
|--------|--------|-------------------|--------|
| Active agents | 20+ | Yes | DB query |
| Error rate (4xx, 5xx) | <1% | Yes | Sentry |
| Database size | <500MB | Yes | Supabase dashboard |
| Webhook delivery success | >95% | Yes | webhook_delivery_logs table |
| User count | 50+ | Yes | DB query |
| Message delivery latency (p95) | <500ms | No — needs Sentry perf | Planned |
| Monthly active users | Track | No — needs analytics | Planned |
| NPS | >50 | No — needs survey tool | Planned |
| Webhook latency (p95) | <5s | No — needs instrumentation | Planned |
| Availability | 99.5% | No — needs uptime monitor | Planned |

---

## Feedback Channels

**Active:**
- GitHub Issues — Bug reports & feature requests
- Buy Me A Coffee — Community support

**Planned:**
- Discord/Slack community
- User interviews with early adopters
- Usage analytics dashboard

---

## Release Process

> **Note:** Target process for when team grows beyond solo development. Current releases are deployed directly.

### Pre-Release
- [ ] Feature complete + tested
- [ ] Docs updated
- [ ] CHANGELOG.md entry added
- [ ] Code review (2+ reviewers)
- [ ] QA on staging

### Release
- [ ] Git tag: v{version}
- [ ] Deploy to production
- [ ] Verify health checks
- [ ] Announce on channels

### Post-Release
- [ ] Monitor error rates
- [ ] Support feedback loop
- [ ] Gather user testimonials
- [ ] Plan next iteration

---

## Known Limitations (MVP)

1. **No message encryption** — All messages visible to admins
2. **No bot-to-bot messaging** — Agents can't message each other
3. **Limited webhook customization** — Fixed payload format
4. **No conversation search** — Linear scan only (planned for 0.4.0)
5. **Pinning is local only** — Not synced across devices (localStorage)
6. **No rate limiting** — Agents can spam (planned for 0.2.0)
7. **Manual testing only** — No automated test suite
8. **Single webhook per agent** — Can't distribute to multiple endpoints
9. **No workspace-level admin** — Only global admin role exists
10. **Multi-session cap hardcoded** — 3-session limit not configurable
11. **No avatar upload moderation** — Users can upload any image
12. **Agent health check has no auto-recovery** — Manual intervention needed
13. **No message read receipt UI** — Infrastructure exists but no visual indicator
14. **Workspace switch doesn't preserve scroll position**

---

## Scaling Considerations

**Current capacity:** ~25-50 concurrent users depending on workspace count
- Supabase free tier: 500 realtime connections
- Each user joins 1 presence channel per workspace
- Example: 30 users × 5 workspaces = 150 presence connections + message channels
- Upgrade to Supabase Pro recommended at 20+ concurrent users

---

For implementation details, see `docs/project-overview-pdr.md` and `docs/system-architecture.md`.
