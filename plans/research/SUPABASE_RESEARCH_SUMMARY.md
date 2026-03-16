# Supabase Real-Time Chat Research Summary

**Completed:** 2026-03-16
**Scope:** Comprehensive evaluation of Supabase for production real-time chat applications
**Deliverables:** 3 research documents

---

## Quick Findings

### What You Get with Supabase for Chat

Supabase provides a **complete, integrated stack** for building real-time chat:

1. **PostgreSQL Database** - Persistent message storage with RLS security
2. **Realtime Service** - WebSocket-based Broadcast + Presence + Postgres Changes
3. **Authentication** - JWT-based user management with OAuth/SSO support
4. **Storage** - Global CDN for file/image attachments (285+ edge locations)
5. **Edge Functions** - Serverless TypeScript for agents, webhooks, processing
6. **RLS (Row Level Security)** - Database-enforced authorization, multi-tenant support

### Best Pattern for Chat

**Dual-Layer Architecture:**
```
Message sent
├─ Save to PostgreSQL (persistence)
├─ Trigger broadcasts to room (instant UI, <50ms)
└─ Other clients get real-time update via RLS-filtered subscription
```

This gives you both **instant messaging** (broadcast) and **chat history** (database) simultaneously.

---

## Core Capabilities

### Realtime Features

| Feature | Use Case | Performance | Guarantee |
|---------|----------|-------------|-----------|
| **Broadcast** | Instant messages, typing | <50ms | Not guaranteed (ephemeral) |
| **Presence** | Online status, typing indicators | <100ms | Automatic cleanup on disconnect |
| **Postgres Changes** | Message history, persistent sync | ~100-500ms | Guaranteed (database-backed) |

### Authentication

- **JWT-based** with RS256 (asymmetric) or HS256
- **Multiple auth methods:** Email/password, magic links, OTP, social login (Google, GitHub, Discord), SSO
- **Admin API** for backend user creation/management
- **Custom JWT claims** for embedding roles/orgs (reduces RLS complexity)

### Storage

- **S3 compatible**, served from 285+ global CDN locations
- **File sizes:** Up to 5 GB per file
- **Image optimization:** On-the-fly resizing, WebP conversion
- **Access control:** RLS-based permissions + signed URLs for private files

### Edge Functions

- **Serverless TypeScript** (Deno-compatible)
- **Webhook-triggered** (e.g., new message → Edge Function)
- **Use cases:** AI agents, message processing, rate limiting, Slack/Discord bots
- **Rate limiting:** March 2026 update restricts recursive function calls

---

## Rate Limits by Plan

| Plan | Connections | Messages/sec | Payload Size |
|------|-------------|--------------|--------------|
| Free | 200 | 100 | 256 KB |
| Pro | 500 | 500 | 256 KB |
| Team/Pro+ | 10,000 | 2,500 | 3,000 KB |
| Enterprise | Custom | Custom | Custom |

**Key:** All limits are per-project and **fully configurable** with support request.

---

## Architecture Recommendations

### For Direct Messaging (1-to-1 DMs)

```sql
-- Minimal schema: 2 tables
CREATE TABLE chats (id, user1_id, user2_id, created_at);
CREATE TABLE messages (id, chat_id, sender_id, content, created_at);

-- RLS: Users see only their own DMs
-- Storage: No attachments table needed (reference Storage via URL)
```

**Cost:** Low (2 tables, simple RLS)
**Latency:** <100ms for new messages

### For Group Messaging (Channels/Teams)

```sql
-- Standard schema: 4 tables
CREATE TABLE channels (id, name, created_by, created_at);
CREATE TABLE channel_members (id, channel_id, user_id, joined_at);
CREATE TABLE messages (id, channel_id, sender_id, content, created_at);
CREATE TABLE message_attachments (id, message_id, file_path, file_type);

-- RLS: Members see channel messages
-- Presence: Track active participants
-- Typing: Debounced broadcast
```

**Cost:** Medium (4+ tables, complex RLS)
**Latency:** <100ms for new messages
**Scale:** Handles thousands of concurrent users per project

### For Agent Integration

```typescript
-- Pattern 1: Webhook on message INSERT
Database INSERT → Edge Function → Call OpenAI → Save response

-- Pattern 2: Scheduled processing
pg_cron → Edge Function → Batch process messages → Run sentiment analysis

-- Pattern 3: Rate limiting
Edge Function receives message → Check quota → Allow/reject
```

**Consideration:** March 2026 rate limit on nested Edge Function calls

---

## Security Checklist

### Must-Have

- ✅ **RLS enabled on all tables** (not just opinions, actual Postgres RLS)
- ✅ **Sender_id = auth.uid() enforced** (prevent impersonation)
- ✅ **Service role never exposed to client** (backend only)
- ✅ **JWT secret strong** (>32 characters)
- ✅ **Storage bucket has access policies** (not public by default)

### Should-Have

- ✅ **Indexes on foreign key columns** (for RLS performance)
- ✅ **Typed indicator debouncing** (max 1 broadcast per 3-5 sec)
- ✅ **Signed URLs for private files** (not public CDN links)
- ✅ **Custom JWT claims** (reduces RLS subquery complexity)

### Testing Before Launch

- ✅ Test RLS as 3+ user types (yourself, another user, anonymous)
- ✅ Verify users can't see each other's DMs
- ✅ Verify chat members can't edit other members' messages
- ✅ Check timestamp fields can't be manipulated

---

## Cost Estimation

**Typical small app (1K DAU, 100K messages/day):**

| Component | Cost |
|-----------|------|
| Database | $5 |
| Realtime | Included |
| Storage (1 GB) | $0.10 |
| Edge Functions (10K calls) | $2 |
| Bandwidth (100 GB) | $12 |
| **Monthly Total (Team Plan)** | **$50** |

**Scales to:**
- 10K DAU: $200-500/month
- 100K DAU: $1-5K/month (Enterprise)

---

## Implementation Timeline

| Phase | Duration | Work |
|-------|----------|------|
| **Setup** | 1 day | Project, schema, auth, RLS policies |
| **MVP** | 3-5 days | Message persistence, real-time sync, presence |
| **Polish** | 2-3 days | Typing indicators, file attachments, error handling |
| **Testing** | 2-3 days | RLS security, load testing, offline behavior |
| **Deploy** | 1 day | Backups, monitoring, go live |

**Total:** ~2 weeks to production for experienced team

---

## Known Limitations & Workarounds

| Issue | Impact | Solution |
|-------|--------|----------|
| Broadcast not guaranteed delivery | Messages can be lost if client disconnects | Always persist to DB first (Broadcast is UI optimization) |
| No E2EE (end-to-end encryption) built-in | Messages visible to Supabase | Implement client-side encryption layer |
| Connection limits per plan | Scaling requires plan upgrade | Team plan handles 10K concurrent users |
| No full-text search on messages | Can't search chat history | Use PostgreSQL FTS or external search (Typesense, Algolia) |
| Typing indicator payload counts against broadcast quota | High-frequency typing wastes throughput | Debounce to 3-5 second intervals |
| Service role in Edge Functions risky | Could be intercepted | Store in secure environment variables only |

---

## When Supabase is Perfect

✅ **Real-time chat with history**
✅ **Multi-tenant SaaS** (RLS per customer)
✅ **1-100K concurrent users**
✅ **Startups** (minimal ops overhead)
✅ **Team collaboration tools**
✅ **Customer support dashboards**
✅ **Game lobbies/matchmaking** (with Broadcast)

## When to Choose Something Else

❌ **Voice/video calling** → Use Twilio, Agora, or Daily
❌ **Guaranteed delivery required** → Use message queue (Kafka, RabbitMQ)
❌ **Millions of messages/day** → Consider sharding or dedicated system
❌ **Offline-first mobile app** → Use SQLite + local sync first
❌ **Strict end-to-end encryption** → Add Signal protocol or similar

---

## Research Documents

### 1. `research-supabase-realtime-chat.md` (This Comprehensive Report)
- **Length:** ~2,500 lines
- **Depth:** Technical deep-dive on all 9 research dimensions
- **Audience:** Architects, senior engineers
- **Contains:** Detailed patterns, code examples, benchmarks, unresolved questions

### 2. `supabase-chat-quick-reference.md` (Copy-Paste Templates)
- **Length:** ~500 lines
- **Depth:** Executable code snippets
- **Audience:** Developers implementing
- **Contains:** Schema templates, RLS policies, React hooks, configuration

### 3. `supabase-chat-implementation-guide.md` (Decision & Deployment)
- **Length:** ~800 lines
- **Depth:** Phase-by-phase implementation strategy
- **Audience:** Technical leads, project managers
- **Contains:** Design decisions, phasing, monitoring, cost calculations, checklists

---

## Key Insights

### Insight #1: Broadcast Isn't Enough
Many developers use **only** Broadcast (ephemeral messages). This loses message history when users disconnect. **Best practice:** Always persist to PostgreSQL, use Broadcast to optimize UI rendering speed.

### Insight #2: RLS is Your Security Layer
Don't validate access in application code. Embed authorization rules directly in PostgreSQL using RLS policies. They're faster, more secure, and automatically apply to Realtime subscriptions.

### Insight #3: JWT Claims Reduce Complexity
Store user role/org in JWT custom claims. RLS policies reference the token instead of querying the database. This reduces subquery overhead and simplifies policies.

### Insight #4: Presence is Automatic Cleanup
Unlike database tracking, Presence automatically cleans up when users disconnect. Use it for online status, typing indicators, active participants—anything ephemeral.

### Insight #5: Scaling is Plan Upgrade, Not Architecture Rework
Supabase handles 10K concurrent users on a single project (Team plan). Until you hit that limit, don't over-engineer. Upgrade plan first.

---

## Next Steps

1. **Decide architecture** (DMs vs Groups) using decision tree in implementation guide
2. **Create test project** at supabase.com
3. **Deploy schema** from quick-reference templates
4. **Write RLS policies** (test thoroughly in development)
5. **Build MVP** with Next.js realtime-chat example
6. **Load test** before going production
7. **Set up monitoring** and backups

---

## Questions for Your Team

- **Single vs multi-tenant?** (DMs vs Groups affects schema significantly)
- **File attachments needed?** (Changes storage bucket strategy)
- **AI agent integration?** (Requires Edge Functions + webhook setup)
- **Scale forecast?** (Determines plan selection)
- **Compliance requirements?** (Affects backup, encryption strategy)

---

## Sources

All sources hyperlinked in the comprehensive research report (`research-supabase-realtime-chat.md`). Key resources:

- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [Realtime Chat Example](https://supabase.com/ui/docs/nextjs/realtime-chat)
- [RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Auth Documentation](https://supabase.com/docs/guides/auth)
- [Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Community Templates](https://github.com/supabase-community/)

---

## Report Metadata

**Completion Date:** 2026-03-16
**Research Scope:** 9 dimensions across Realtime, Auth, Storage, RLS, Edge Functions, Rate Limiting, and Templates
**Primary Sources:** 9 web searches + 5 technical document fetches
**Document Structure:** 3 progressive documents (comprehensive → templates → implementation)
**Intended Audience:** Architects making tech stack decisions → Developers building → Technical leads managing deployment

