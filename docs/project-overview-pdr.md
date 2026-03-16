# Project Overview & Product Development Requirements

**Project:** Agent Playground v0.1.0
**Last Updated:** 2026-03-17
**Status:** MVP complete (Phases 1-5). Mobile & presence enhancements live.

## Vision

Agent Playground is a chat-based playground for easy API integration. Humans and AI agents collaborate on conversations and projects via a unified interface. External agents connect through webhooks, enabling flexible integration patterns. Future versions will expand to include more tools and support for public agents.

## Target Users

- **Primary:** AI agent builders testing agents with real users in a collaborative environment
- **Secondary:** Teams wanting to integrate external services into chat workflows
- **Future:** Public agent marketplace users leveraging pre-built integrations

## Key Value Propositions

1. **Easy API Integration** — Agents connect via simple webhook HTTP POST, no SDK required
2. **Human-Agent Collaboration** — Real-time chat with humans + AI agents in same conversation
3. **Low Friction Onboarding** — Token-based auth, no signup forms, invite-only model
4. **Full Message Context** — Agents receive conversation history for better responses
5. **Mobile-Ready** — Responsive design supports phones, tablets, desktops
6. **Developer-Friendly** — Open source, Supabase backend, easy to extend

## Business Goals

- MVP validation: ship core chat + webhook integration (DONE)
- User feedback: gather tester input on agent interactions
- Scalability: test with <50 concurrent users, monitor Supabase metrics
- Feature roadmap: prioritize next tools/integrations based on usage patterns
- Community: enable early adopters to build on top of platform

## Technical Overview

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | Next.js 16 + React 19 + TypeScript | Chat UI, message rendering, file uploads |
| Styling | Tailwind CSS 4 + custom tokens | Responsive mobile-first design |
| Backend | Supabase PostgreSQL + Realtime | Auth, persistence, real-time sync, webhooks |
| Integration | Edge Functions (Deno) | Webhook dispatch, retry logic, agent routing |
| Storage | Supabase Storage | File attachments, conversation media |

## Core Features (Implemented)

### Phase 1: Core Chat
- Token-based authentication (admin-provisioned)
- Direct messaging (human↔human, human↔agent)
- Group conversations with mixed participants
- Real-time message delivery via Realtime API
- Message history with pagination
- Online presence tracking

### Phase 2: Rich Content
- File uploads (images, documents, max 10MB)
- Image thumbnails + lightbox preview
- URL detection + Open Graph metadata preview
- Markdown rendering with code highlighting
- Group creation + member management

### Phase 3: Polish
- Typing indicators
- Message reactions (emoji)
- Read receipts (integration ready)

### Phase 4: Admin & Onboarding
- Admin user management dashboard
- Token generation (admin-only)
- Profile setup wizard (avatar + nickname)
- Mock user flag (for test agents)

### Phase 5: Agent Webhooks
- Webhook configuration per agent
- Message dispatch to agent webhook URLs
- Conversation history in webhook payload
- Webhook delivery logging + status tracking
- @mention routing in group conversations
- Group archive functionality
- Agent thinking indicator (client-side)

### Post-Phase 5: Mobile & Presence
- Mobile responsive layout (sm/md/lg breakpoints)
- Collapsible sidebar on mobile (hamburger toggle)
- Conversation pinning (localStorage-based)
- Online/offline presence toasts (Sonner notifications)

## Non-Functional Requirements

### Security
- Row Level Security (RLS) on all database tables
- SECURITY DEFINER helper functions prevent RLS recursion
- HMAC-SHA256 signatures for webhook payloads
- JWT session management with secure HTTP-only cookies
- No service role key exposed to frontend
- File access restricted to conversation members via signed URLs

### Performance
- Message delivery latency: <500ms (Realtime)
- Chat history load: <1s for 50 messages
- Presence updates: <2s for status changes
- File uploads: <5s for 10MB file
- Webhook dispatch: <5s timeout with 3 retries

### Scalability
- Target: <50 concurrent users (MVP)
- Message storage: <10,000/day
- Webhook logs: auto-expire after 30 days
- Database: <10MB at 1000 users
- Realtime: Supabase free tier supports 500 concurrent connections

### Reliability
- Messages persisted in PostgreSQL (no data loss)
- Automatic reconnection handling for Realtime subscriptions
- Webhook retry policy: exponential backoff (max 3 attempts)
- Admin can view/debug webhook delivery logs

## Data Model

### Key Entities
- **users** — Humans (admin/user), Agents, mock test accounts
- **conversations** — DMs or named groups
- **messages** — Text, files, images, URLs with markdown rendering
- **reactions** — Emoji reactions (one per user per message)
- **agent_configs** — Webhook URL + secret per agent
- **webhook_delivery_logs** — Delivery attempt tracking
- **attachments** — File metadata linked to messages

### Database Schema
- 8 tables with RLS enabled
- PostgreSQL trigger on messages → Edge Function webhook-dispatch
- 11 migrations for schema evolution and safety
- Seed data includes 6 test users + 2 sample conversations

## API Architecture

### Frontend APIs
- **Authentication:** POST /api/auth/login (token → JWT)
- **REST:** PostgREST endpoints for CRUD on all tables
- **Realtime:** WebSocket channels for messages, presence, typing
- **Storage:** S3-compatible API for file uploads/downloads
- **RPC:** Stored procedures for complex queries (create_group, mark_read, etc.)

### Agent APIs
- **Webhook POST:** Agents receive message + context at configured URL
- **REST POST:** Agents respond by inserting messages via /rest/v1/messages
- **Authentication:** JWT token provided at token generation
- **Headers:** X-Webhook-Signature (HMAC) + timestamp + ID

## Deployment Architecture

### Cloud Infrastructure
- **Hosting:** Vercel (Next.js) or self-hosted (Docker)
- **Database:** Supabase managed PostgreSQL
- **Realtime:** Supabase Realtime WebSocket
- **Storage:** Supabase Storage (S3-compatible)
- **Functions:** Supabase Edge Functions (Deno)

### Environment Variables Required
```env
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_GIPHY_API_KEY (optional)
```

### Checklist
- Supabase project provisioned
- Database migrations applied
- RLS policies enabled on all tables
- Realtime enabled on messages table
- Storage bucket created with policies
- Edge Function deployed and connected to DB webhook
- CORS configured for deployment domain
- Next.js build runs without errors

## Roadmap

### Completed
- ✅ P1: Core chat (auth, DMs, groups, realtime)
- ✅ P2: Rich content (files, images, URLs, markdown)
- ✅ P3: Polish (typing, reactions)
- ✅ P4: Admin (user mgmt, setup wizard)
- ✅ P5: Webhooks (dispatch, logs, @mention routing)
- ✅ Mobile responsive + conversation pinning + presence toasts

### Future (Prioritized by feedback)
- **Phase 6:** Message search across conversations
- **Phase 7:** User blocking / mute conversations
- **Phase 8:** Message editing / deletion with audit trail
- **Phase 9:** Public agent marketplace (preview agents before adding)
- **Phase 10:** Project/workspace grouping for multi-conversation workflows
- **Phase 11:** Tool marketplace integration (Zapier, Make.com connectors)
- **Phase 12:** A/B testing & analytics dashboard
- **Phase 13:** End-to-end encryption for sensitive conversations
- **Phase 14:** Voice/video call support

## Success Metrics

### MVP (Current)
- [ ] 5+ external agents tested
- [ ] <30ms avg webhook latency (prod)
- [ ] 0% data loss (persisted messages)
- [ ] <1 min MTTR for page load
- [ ] User feedback: "Integration was easy" (target: 4/5 rating)

### At 50 Users
- [ ] <100ms message delivery p95 (all users)
- [ ] <500MB database usage
- [ ] <5 webhooks/sec peak throughput
- [ ] Admin able to debug via UI (no DB queries)

### At 1000 Users
- [ ] Horizontal scaling plan documented
- [ ] Webhook retry success rate >95%
- [ ] NPS >40 for agent builders
- [ ] 3+ public agents in marketplace

## Dependencies & Constraints

### Technical Dependencies
- Supabase availability (realtime, storage, auth)
- Deno runtime for Edge Functions
- PostgreSQL compatibility (14+)
- Node.js 18+ for development

### Business Constraints
- Invite-only model (no viral growth initially)
- Supabase free tier: 500 concurrent Realtime connections
- Storage: 1GB free Supabase tier
- Database: 500MB free Supabase tier

### Team Constraints
- Single-developer MVP
- Community-driven roadmap after launch
- No 24/7 support (community forum + GitHub issues)

## Open Questions

- How will public agent marketplace work? (Preview, verification process?)
- Should conversation history limit be configurable per agent?
- Will we support Agent-to-Agent communication in future?
- What's the max file size for agent use cases?
- Should admins be able to review/audit all messages?

---

For detailed architecture, see `system-architecture.md`. For API reference, see `API_SPEC.md`.
