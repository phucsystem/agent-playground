# Lean MVP Analysis: Agent Playground

## Problem Statement

AI agent builders need a way to share agents with specific friends/testers for real-world capability verification. Current options (sharing API keys, deploying full apps, screen-sharing) are either insecure, high-effort, or lack collaborative context. The goal is a lightweight chat platform where invited users can interact with shared agents in real-time — seeing each other online, DMing humans or agents, and forming groups — while the owner maintains full control over access.

## Target Users (→ IPA User Roles)

| User Type | Description | Primary Need |
|-----------|-------------|--------------|
| **Owner (Admin)** | You — agent builder who controls the platform | Share agents with select people, enable/disable access via Supabase DB |
| **Tester** | Invited friend/colleague verifying agent capabilities | Chat with agents, share feedback, see others' interactions |
| **Agent** | AI agent integrated via Supabase API | Send/receive messages (text, URLs, docs, images) in DMs or groups |

## MVP Features (→ IPA Feature List FR-xx)

| Priority | Feature | User Value | Screen | Assumption |
|----------|---------|------------|--------|------------|
| P1 | Auth with admin-controlled tokens | Only invited users access the app | Login | Users accept token-based auth (no self-signup) |
| P1 | Online presence | See who's online (humans + agents) | Sidebar | Real-time presence matters for testing coordination |
| P1 | Direct messaging (human↔human) | Coordinate testing, share observations | Chat/DM | Testers want to discuss agent behavior with each other |
| P1 | Direct messaging (human↔agent) | Primary agent testing interface | Chat/DM | 1:1 agent testing is the core use case |
| P1 | Text + markdown messages | Basic communication | Chat | Markdown needed for agent code/structured responses |
| P1 | Message persistence | Chat history preserved across sessions | Chat | Testers need to review past conversations |
| P2 | File attachments (images, docs) | Agents send rich content (screenshots, PDFs) | Chat | File sharing is essential for agent capability demo |
| P2 | URL previews | Agents share links with context | Chat | URLs are a primary agent output type |
| P2 | Group chat | Multi-agent or multi-tester conversations | Group Chat | Group testing useful but not day-1 critical |
| P2 | Admin enable/disable users | Owner controls who can access | Supabase DB | Direct DB toggle sufficient for MVP (no admin UI needed) |
| P3 | Typing indicators | See when someone is composing | Chat | Nice UX polish, not critical |
| P3 | Read receipts | Know messages were seen | Chat | Helpful but deferrable |
| P3 | Message reactions | Quick feedback on agent responses | Chat | Lightweight feedback mechanism |

## Implementation Phases (Estimated)

| Phase | Focus | Key Features | Effort |
|-------|-------|--------------|--------|
| 1 | **Core Chat** | Auth, presence, DM (text/markdown), message persistence | M |
| 2 | **Rich Content + Groups** | File attachments, URL previews, group chat, agent API integration | M |
| 3 | **Polish** | Typing indicators, read receipts, reactions, notifications | S |

## Plan Structure Preview

```
plans/{date}-agent-playground/
├── plan.md
├── phase-01-core-chat/
│   ├── data.md    # Supabase schema, RLS, realtime setup
│   ├── core.md    # Auth flow, message handling, presence
│   └── ui.md      # Custom chat UI with shadcn + Tailwind
├── phase-02-rich-content-groups/
│   ├── data.md    # File storage, group tables
│   ├── core.md    # Upload handling, group logic, agent API
│   └── ui.md      # File previews, group UI, agent indicators
└── phase-03-polish/
    └── tasks.md   # Typing indicators, read receipts, reactions
```

## MVP Screens (→ IPA Screen List S-xx)

| Screen | Purpose | Features |
|--------|---------|----------|
| S-01: Login | Token-based authentication | Token input, validation, error state |
| S-02: Sidebar | Navigation + presence | Online users list (humans/agents), conversation list, search |
| S-03: DM Chat | 1:1 messaging | Message thread, input with attachments, markdown rendering (react-markdown) |
| S-04: Group Chat | Multi-party messaging | Same as DM + member list, agent badges |
| S-05: Chat Info | Conversation details | Participants, shared files, settings |

## Data Entities (→ IPA Entity List E-xx)

| Entity | Description | Key Fields |
|--------|-------------|------------|
| E-01: users | Human users + agents | id, email, display_name, avatar_url, is_agent, is_active, token, last_seen_at |
| E-02: conversations | DM or group container | id, type (dm/group), name, created_by, created_at |
| E-03: conversation_members | Who's in each conversation | conversation_id, user_id, joined_at, role (admin/member) |
| E-04: messages | Chat messages | id, conversation_id, sender_id, content, content_type (text/file/image/url), metadata, created_at |
| E-05: attachments | Files linked to messages | id, message_id, file_name, file_url, file_type, file_size, storage_path |

## User Flow (→ IPA Screen Flow)

```
[Login S-01] → [Sidebar S-02] → [DM Chat S-03] or [Group Chat S-04]
                    ↓
              [Chat Info S-05]
```

**Agent Flow:**
```
Agent → Supabase REST API → Insert message into messages table
     → Supabase Realtime broadcasts to all conversation members
     → Upload file to Supabase Storage → Attach URL to message
```

## Tech Decisions (→ IPA Key Decisions D-xx)

| Decision | Context | Chosen | Rationale |
|----------|---------|--------|-----------|
| D-01: UI Framework | Need chat UI + group messaging | **Next.js + Custom React Chat + shadcn/ui + Tailwind** | assistant-ui only supports single-user AI chat (3 hardcoded roles, no multi-user). Custom chat components with react-markdown + remark-gfm for agent message rendering. shadcn/ui for general UI. Full control over DM + group messaging. |
| D-02: Backend | Need auth, DB, realtime, storage | **Supabase** | All-in-one: Postgres, Realtime (presence + broadcast + DB changes), Auth, Storage. No separate backend needed. |
| D-03: Realtime strategy | Messages + presence | **Supabase Realtime (Postgres Changes + Presence)** | Dual-layer: Presence for online status, Postgres Changes for message delivery. Persistent + real-time. |
| D-04: Auth model | Admin-controlled access | **Token-based, manual provisioning** | Owner provides tokens, toggles is_active in DB. No self-signup. Simplest for invite-only. |
| D-05: Agent integration | Agents need to send messages | **Supabase client SDK / REST API** | Agents use service role key or user JWT to insert messages directly. Simplest path, full Supabase feature access. |
| D-06: File storage | Agents send docs/images | **Supabase Storage** | Integrated with RLS, same auth system. Buckets per conversation or global with path-based access. |
| D-07: Tamagui | User wanted Tamagui | **Dropped** | Web-only project doesn't benefit from universal UI. Tailwind + shadcn is simpler and proven. |
| D-08: assistant-ui | User wanted assistant-ui | **Dropped** | Only supports single-user ↔ AI chat (3 hardcoded roles: user/assistant/system). No multi-user identity, no group messaging. Custom React chat is simpler for this use case. |
| D-09: Markdown rendering | Agent messages need rich formatting | **react-markdown + remark-gfm + rehype-highlight** | Lightweight, proven stack for rendering agent responses with code blocks, tables, links. |

## Nice-to-Have (Post-MVP)

- **Admin dashboard** — UI for managing users/agents instead of direct DB edits
- **Agent marketplace** — Browse and subscribe to shared agents
- **Conversation search** — Full-text search across message history
- **Message threading** — Reply-to-specific-message threads
- **Agent analytics** — Track response times, success rates, usage patterns
- **Mobile app** — React Native (if needed later)
- **Voice messages** — Audio recording and playback
- **Webhook notifications** — Notify users of new messages when offline

## Key Assumptions to Validate

1. **Token auth is acceptable** — Testers don't mind receiving a token vs. standard login. Validate: Ask 3+ testers if flow feels okay.
2. **Small user count** — <50 concurrent users. Supabase free/pro tier handles this. Validate: Monitor Realtime connection limits.
3. **Agents can use Supabase SDK** — Agent frameworks can integrate Supabase client. Validate: Prototype one agent sending a message via REST API.
4. **Custom chat UI is sufficient** — Custom React components with shadcn/ui + react-markdown deliver good enough UX. Validate: Build DM prototype in Phase 1.
5. **Supabase Realtime scales for presence** — Presence API handles 20-50 concurrent users. Validate: Load test with simulated connections.

## Out of Scope

- Self-registration / public signup
- Payment / billing
- Mobile native app
- End-to-end encryption
- Agent creation/configuration UI (agents are pre-built, integrated externally)
- Admin UI for user management (direct DB toggle for MVP)
- Message editing/deletion
- Video/voice calls

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Custom chat UI quality | Medium — no pre-built chat framework, need to build message list, input, presence from scratch | Use shadcn/ui primitives (ScrollArea, Input, Avatar, Badge) to accelerate. Reference Supabase chat examples. |
| Supabase Realtime connection limits | Medium — free tier limits concurrent connections | Monitor usage, upgrade to Pro ($25/mo) if needed |
| Agent auth complexity | Medium — agents need proper credentials without exposing service key | Use per-agent JWT tokens with scoped RLS policies |
| File storage costs | Low — depends on usage volume | Set upload size limits (10MB), use Supabase Storage free tier (1GB) |
| Token-based auth UX friction | Low — testers may find token login awkward | Provide clear onboarding instructions, consider magic links later |

## 🚦 GATE 1: Scope Validation

Before proceeding to `/ipa:spec`, complete this checklist:

- [ ] Talked to 3+ potential testers about the concept
- [ ] Testers confirmed they'd use a shared agent chat platform
- [ ] MVP scope acceptable (3 phases — at the limit)
- [ ] Assumptions documented for later validation
- [ ] Agent SDK integration tested (one agent sending a message via Supabase REST)

**⚠️ Scope is at the 3-phase limit. Do not add features without removing something.**

## Next Step

After GATE 1 validation:
→ Run `/ipa:spec` to generate SRD.md + UI_SPEC.md
→ Reference designs: Slack, Discord for chat layout inspiration
