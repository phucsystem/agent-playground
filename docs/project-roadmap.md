# Project Roadmap

**Last Updated:** 2026-03-17
**Current Version:** 0.1.0
**Status:** MVP live with mobile + presence enhancements

## Release Timeline

### ✅ 0.1.0 — MVP (Current)

**Released:** 2026-03-17

**Phases 1-5 Complete:**
- P1: Core chat (auth, DMs, groups, realtime)
- P2: Rich content (files, images, URLs, markdown)
- P3: Polish (typing indicators, reactions)
- P4: Admin (user management, setup wizard, mock flag)
- P5: Agent webhooks (dispatch, delivery logs, @mention routing, thinking indicator)

**Post-Phase 5 Enhancements:**
- Mobile responsive layout (sm/md/lg breakpoints)
- Hamburger sidebar toggle for mobile
- Conversation pinning (localStorage-based)
- Online/offline presence toasts (Sonner notifications)
- Conversation history in webhook payloads
- Group archive functionality
- @mention autocomplete in group messages

**Technology Stack:**
- Next.js 16, React 19, TypeScript 5.9
- Tailwind CSS 4.2
- Supabase (PostgreSQL, Realtime, Auth, Storage, Edge Functions)
- Markdown: react-markdown + remark-gfm + rehype-highlight
- UI: Lucide icons, Sonner toasts, TanStack React Virtual

**Metrics:**
- ~75 source files
- ~6,080 LOC
- 12 custom hooks
- 26 components
- 11 database migrations
- 1 Edge Function

---

### 🎯 0.2.0 — Search & Discovery (Planned Q2 2026)

**Duration:** 4-6 weeks
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

### 🎯 0.3.0 — User Controls (Planned Q2 2026)

**Duration:** 2-3 weeks
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

### 🎯 0.4.0 — Message Management (Planned Q3 2026)

**Duration:** 3-4 weeks
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

### 🎯 0.5.0 — Public Agent Marketplace (Planned Q3 2026)

**Duration:** 6-8 weeks
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

**Rationale:**
- Enable marketplace ecosystem
- Reduce friction for new users to try agents
- Build community around platform

---

### 🎯 0.6.0 — Projects & Workspaces (Planned Q3-Q4 2026)

**Duration:** 8-10 weeks
**Priority:** High (enterprise)

**Features:**
- Project/workspace grouping
- Multiple workspaces per user
- Per-workspace agents
- Per-workspace conversation limits/quotas
- Workspace settings (name, description, avatar)

**Architecture:**
- New `workspaces` table
- Update `conversations`, `agent_configs` to include `workspace_id`
- New RLS policies per workspace

**Rationale:**
- Support teams managing multiple projects
- Enable better organization of conversations
- Foundation for SaaS pricing model

---

### 🎯 0.7.0 — Tool Marketplace (Planned Q4 2026)

**Duration:** 8-12 weeks
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

## Backlog (Future Consideration)

### Nice-to-Have Features
- **Voice/Video Calls** — In-conversation video (Livekit, Daily.co)
- **CMS Integration** — Import docs as agents (knowledge base)
- **Analytics Dashboard** — Agent usage, conversation metrics, engagement
- **A/B Testing** — Test prompt variations, measure conversion
- **End-to-End Encryption** — For sensitive conversations
- **Message Reactions** — Beyond emoji (custom stickers, GIFs)
- **Conversation Templates** — Pre-built workflows
- **Agent-to-Agent** — Allow agents to message each other
- **Scheduled Messages** — Send at specific time
- **Rate Limiting** — Per-user, per-agent quotas
- **Sentiment Analysis** — Auto-tag conversations by sentiment
- **Conversation Summaries** — Auto-generate conversation summary

### Under Investigation
- **Alternative Backends** — Self-hosted option (n8n, Apache Airflow)
- **Mobile Native** — React Native for iOS/Android
- **Desktop App** — Electron for Windows/Mac
- **Webhooks v2** — Event streaming (Kafka, webhook queues)
- **GraphQL** — Alternative to REST API
- **Multi-Language** — i18n support

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

## Metrics to Track

### Adoption Metrics
- Number of signed-up users
- Monthly active users (MAU)
- Conversation creation rate
- Agent integration rate

### Engagement Metrics
- Avg messages/user/day
- Conversation completion rate (resolved vs. abandoned)
- Webhook success rate
- Time from agent question to response

### Quality Metrics
- Message delivery latency (p50, p95, p99)
- Webhook retry rate
- Error rate (4xx, 5xx)
- Availability (target: 99.5%)

### Business Metrics
- NPS (Net Promoter Score) target: >50
- Time to agent integration (target: <1 hour)
- Support ticket volume
- Feature request frequency

---

## Feedback Channels

- **Discord/Slack** — Community feedback & feature requests
- **GitHub Issues** — Bug reports & technical discussions
- **User Interviews** — Monthly calls with early adopters
- **Usage Analytics** — Supabase dashboard metrics
- **Admin Dashboard** — Feature usage tracking

---

## Release Process

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
3. **Limited webhook customization** — Fixed payload format (could be template-based)
4. **No conversation search** — Linear scan only (will add in 0.2.0)
5. **Pinning is local only** — Not synced across devices
6. **No rate limiting** — Agents can spam (should add throttling)
7. **Manual testing only** — No load tests yet
8. **Single webhook per agent** — Can't distribute to multiple endpoints

---

## Success Definition (6-Month Horizon)

- [ ] 20+ active agents in system
- [ ] <500ms avg webhook latency
- [ ] Public agent marketplace launched
- [ ] 5+ teams using for multi-project workflows
- [ ] NPS >50 from users
- [ ] 0 security incidents
- [ ] Self-hosted documentation + deployment guide

---

For implementation details, see `docs/project-overview-pdr.md` and `docs/system-architecture.md`.
