# System Requirement Definition (SRD)

## 1. System Overview

**Project:** Agent Playground
**Purpose:** Playground for easy API integration via chat interface. Humans and AI agents collaborate on conversations and projects with real-time communication. External agents connect via webhooks. Future direction: expand to more tools and public agents.

**Tech Stack:**
- Frontend: Next.js + React + shadcn/ui + Tailwind CSS
- Backend: Supabase (Postgres + Realtime + Auth + Storage)
- Markdown: react-markdown + remark-gfm + rehype-highlight
- Agent Integration: Supabase REST API / client SDK

**Key Constraints:**
- Invite-only (no self-registration)
- Admin controls access via database toggle
- <50 concurrent users (Supabase free/pro tier)
- Web-only (no mobile native)

## 2. Actors (User Roles)

| ID | Role | DB Value | Description | Permissions |
|----|------|----------|-------------|-------------|
| R-01 | **Admin** | `admin` | Agent builder who controls the platform | Full access. Manage users (enable/disable/delete), generate tokens, create convos. Access admin page. |
| R-02 | **User** | `user` | Invited human tester | Send/receive messages in DMs and groups. View online presence. Upload files. Complete profile setup on first login. |
| R-03 | **Agent** | `agent` | AI agent integrated via Supabase API | Send/receive messages (text, URLs, docs, images) in assigned DMs or groups. No UI access — API only. |

## 3. Functional Requirements (FR-xx)

### Phase 1 — Core Chat (P1)

| ID | Feature | Priority | Description | Screens |
|----|---------|----------|-------------|---------|
| FR-01 | Token-based authentication | P1 | User enters a pre-provisioned token (64-char with special chars, generated via crypto.getRandomValues). System validates against `users` table, checks `is_active`. Token cached in localStorage for auto-login. No self-registration. | S-01 |
| FR-02 | Session management | P1 | After login, JWT session persisted in cookie. Auto-redirect to chat on valid session. Logout clears session. | S-01, S-02 |
| FR-03 | Online presence | P1 | Show real-time online/offline status for all users (humans + agents) in sidebar. Use Supabase Presence API. | S-02 |
| FR-04 | Conversation list | P1 | Sidebar shows all conversations user is a member of, sorted by last message time. Unread indicator badge. | S-02 |
| FR-05 | Direct messaging | P1 | 1:1 conversations between any two participants (human↔human or human↔agent). Start new DM by selecting a user from presence list. | S-02, S-03 |
| FR-06 | Text + markdown messages | P1 | Send and receive text messages with markdown rendering (headings, bold, italic, code blocks, tables, links). Agent messages render with syntax-highlighted code. | S-03 |
| FR-07 | Message persistence | P1 | All messages stored in Postgres. Load message history on conversation open (paginated, newest first). | S-03 |
| FR-08 | Real-time message delivery | P1 | New messages appear instantly for all conversation participants via Supabase Realtime (Postgres Changes). | S-03 |
| FR-09 | User profile display | P1 | Each message shows sender avatar, display name, timestamp. Agent messages have a distinct badge/indicator. | S-03 |

### Phase 2 — Rich Content + Groups (P2)

| ID | Feature | Priority | Description | Screens |
|----|---------|----------|-------------|---------|
| FR-10 | File attachments | P2 | Upload and send images (jpg, png, gif, webp) and documents (pdf, txt, md, csv). Max 10MB per file. Files stored in Supabase Storage. | S-03, S-04 |
| FR-11 | Image preview | P2 | Inline image thumbnails in chat. Click to view full-size in lightbox. | S-03, S-04 |
| FR-12 | URL detection + preview | P2 | Auto-detect URLs in messages. Display clickable links with optional Open Graph metadata preview (title, description, favicon). | S-03, S-04 |
| FR-13 | Group conversations | P2 | Create named group conversations with 3+ participants (humans and/or agents). Owner can add/remove members. | S-02, S-04, S-05 |
| FR-14 | Agent API integration | P2 | Agents authenticate via JWT or service key. Send messages (text, file URL, image URL) via Supabase REST API insert to `messages` table. Receive messages via Supabase Realtime subscription or polling. | — (API) |
| FR-15 | Admin user toggle | P2 | Owner sets `is_active = false` in `users` table to disable a user. Disabled users cannot log in. Active sessions terminated on next API call. | — (DB) |

### Phase 3 — Polish (P3)

| ID | Feature | Priority | Description | Screens |
|----|---------|----------|-------------|---------|
| FR-16 | Typing indicators | P3 | Show "User is typing..." when a participant is composing a message. Use Supabase Broadcast channel. | S-03, S-04 |
| FR-17 | Read receipts | P3 | Mark messages as read when conversation is open and visible. Show read status indicator. | S-03, S-04 |
| FR-18 | Message reactions | P3 | React to messages with emoji (heart ❤️ button). One reaction per user per message. Show reaction counts. | S-03, S-04 |

### Phase 4 — Admin & Onboarding (P4)

| ID | Feature | Priority | Description | Screens |
|----|---------|----------|-------------|---------|
| FR-19 | Admin user management | P4 | Admin can view all users, generate tokens, enable/disable, and delete accounts. Access via /admin page. | S-06 |
| FR-20 | Profile setup wizard | P4 | New users complete avatar selection (DiceBear 12 styles) and nickname entry on /setup. Admin generates invite tokens only (no name/email fields); system auto-generates placeholder email `invite-{shortId}@placeholder.local` and default name "New User". User sets real name/avatar on first login. | S-07 |
| FR-21 | Mock user flag | P4 | Admins can mark users as mock. Non-admin users see only non-mock users in presence list. | S-02, S-06 |

### Phase 5 — Agent Webhook Integration (P5)

| ID | Feature | Priority | Description | Screens |
|----|---------|----------|-------------|---------|
| FR-22 | Agent webhook configuration | P5 | When admin generates an agent token ("Is agent?" checked), show webhook config fields: webhook URL + optional secret. Stored in `agent_configs` table. Decoupled from core chat — webhook config only applies to agent users. | S-06 |
| FR-23 | Webhook message delivery | P5 | When a new message is inserted into a conversation containing agent members, a Supabase Edge Function fires a POST to each agent's `webhook_url` with the message payload + conversation context. Skips messages sent by agents (prevents loops). Includes HMAC-SHA256 signature header if secret is configured. | — (Edge Function) |
| FR-24 | Agent response via REST | P5 | External agent services receive the webhook, process the message (call LLM, run tools, etc.), and respond by POSTing back to `POST /rest/v1/messages` using the agent's existing JWT. No new endpoint needed — reuses FR-14. | — (API) |
| FR-25 | Webhook delivery status | P5 | Track webhook delivery attempts per message: status (pending/delivered/failed), HTTP status code, retry count (max 3, exponential backoff). Admin can view delivery logs for debugging. | S-08 |
| FR-26 | Agent webhook toggle | P5 | Admin can enable/disable an agent's webhook without deleting the config. Disabled agents remain in conversations but don't receive webhook triggers. | S-06 |
| FR-27 | Group @mention routing | P5 | In group conversations with multiple agents, only agents that are @mentioned (case-insensitive match against agent display_name) receive webhooks. No @mentions → "No agents mentioned" (200). DMs dispatch to all agents. | S-04 |
| FR-28 | Agent thinking indicator | P5 | Display "Agent is thinking..." with animated dots when user sends message in agent DM. Clear when agent message arrives or after 30s timeout. Client-side heuristic, no backend involvement. | S-03 |
| FR-29 | @Mention syntax support | P5 | Users can @mention agents in group messages using `@AgentName` syntax (case-insensitive). Only matched agents receive webhooks. | S-04 |

### Phase 6 — Mobile & Presence (Post-Phase 5)

| ID | Feature | Priority | Description | Screens |
|----|---------|----------|-------------|---------|
| FR-30 | Mobile responsive layout | P6 | Support mobile devices (sm:, md:, lg: breakpoints). Sidebar collapses on mobile, expandable via hamburger menu. Chat input adjusts for touch. | S-02, S-03, S-04 |
| FR-31 | Conversation pinning | P6 | Users can pin conversations to top of list. Pinned state stored in browser localStorage per user. | S-02 |
| FR-32 | Presence toasts | P6 | Toast notifications when users come online/offline. Dismissible via Sonner toast component. Includes user avatar and status. | — (UI) |

## 4. Screen List (S-xx)

| ID | Screen Name | Description | Phase |
|----|-------------|-------------|-------|
| S-01 | Login | Token input form with validation and error state | P1 |
| S-02 | Main Layout (Sidebar) | Left sidebar with presence (filtered by mock flag), conversation list, search. Right area for active chat. | P1 |
| S-03 | DM Chat | 1:1 message thread with input, attachments, markdown, heart reaction button | P1 |
| S-04 | Group Chat | Multi-party message thread with member list, agent badges, reactions | P2 |
| S-05 | Chat Info Panel | Slide-over panel showing conversation participants, shared files, settings | P2 |
| S-06 | Admin Page | User management dashboard: list all users, token generation, enable/disable/delete actions | P4 |
| S-07 | Setup Page | Profile setup wizard: avatar picker (DiceBear 12 styles) + nickname entry | P4 |
| S-08 | Webhook Logs | Delivery log viewer for agent webhook attempts (admin only) | P5 |

## 5. Entity List (E-xx)

| ID | Entity | Description | Key Fields |
|----|--------|-------------|------------|
| E-01 | `users` | Human users and agents | `id` (uuid, PK), `email` (text, unique), `display_name` (text), `avatar_url` (text, nullable), `role` (enum: admin/user/agent), `is_mock` (bool, default false), `is_active` (bool, default true), `token` (text, unique), `last_seen_at` (timestamptz) |
| E-02 | `conversations` | DM or group container | `id` (uuid, PK), `type` (enum: dm/group), `name` (text, nullable — null for DMs), `created_by` (uuid, FK → users), `created_at` (timestamptz) |
| E-03 | `conversation_members` | Membership join table | `conversation_id` (uuid, FK), `user_id` (uuid, FK), `joined_at` (timestamptz), `role` (enum: admin/member), PK: (conversation_id, user_id) |
| E-04 | `messages` | Chat messages | `id` (uuid, PK), `conversation_id` (uuid, FK), `sender_id` (uuid, FK → users), `content` (text), `content_type` (enum: text/file/image/url), `metadata` (jsonb, nullable), `created_at` (timestamptz) |
| E-05 | `attachments` | Files linked to messages | `id` (uuid, PK), `message_id` (uuid, FK), `file_name` (text), `file_url` (text), `file_type` (text), `file_size` (int), `storage_path` (text) |
| E-06 | `reactions` | Message reactions (P3) | `id` (uuid, PK), `message_id` (uuid, FK), `user_id` (uuid, FK), `emoji` (text), `created_at` (timestamptz), UNIQUE: (message_id, user_id, emoji) |
| E-07 | `agent_configs` | Webhook configuration per agent (P5) | `id` (uuid, PK), `user_id` (uuid, FK → users, UNIQUE), `webhook_url` (text, NOT NULL), `webhook_secret` (text, nullable), `is_webhook_active` (bool, default true), `created_at` (timestamptz), `updated_at` (timestamptz) |
| E-08 | `webhook_delivery_logs` | Webhook delivery tracking (P5) | `id` (uuid, PK), `message_id` (uuid, FK → messages), `agent_id` (uuid, FK → users), `status` (enum: pending/delivered/failed), `http_status` (int, nullable), `attempt_count` (int, default 0), `last_error` (text, nullable), `created_at` (timestamptz), `delivered_at` (timestamptz, nullable) |

## 6. Non-Functional Requirements

### Performance
- Message delivery latency: <500ms (Supabase Realtime)
- Chat history load: <1s for 50 messages
- Presence update: <2s for online/offline transitions
- File upload: <5s for 10MB file

### Security
- Token-based auth — tokens are unique, unguessable (64-char with full charset: A-Za-z0-9!@#$%^&*()-_=+[]{}|;:<>?, generated via crypto.getRandomValues)
- Row Level Security (RLS) on all tables — users can only access their own conversations
- File access restricted to conversation members via signed URLs
- No service key exposed to frontend — use Supabase anon key + RLS
- Agent tokens scoped to specific conversations
- Token caching in localStorage with logout clear on both client and sidebar

### Scalability
- Target: <50 concurrent users
- Supabase free tier: 500 concurrent Realtime connections
- Message volume: <10,000 messages/day
- Storage: <1GB (Supabase free tier)

### Reliability
- Messages persisted in Postgres — no data loss on disconnect
- Reconnection handling for Realtime subscriptions
- Optimistic UI updates with server confirmation

## 7. Key Decisions (D-xx)

| ID | Decision | Chosen | Rationale |
|----|----------|--------|-----------|
| D-01 | UI Framework | Next.js + Custom React + shadcn/ui + Tailwind | Full control over multi-user chat. assistant-ui dropped (single-user only). |
| D-02 | Backend | Supabase | All-in-one: DB + Realtime + Auth + Storage. No separate backend. |
| D-03 | Realtime | Supabase Realtime (Postgres Changes + Presence + Broadcast) | Dual-layer: Presence for online status, Postgres Changes for messages, Broadcast for typing. |
| D-04 | Auth | Token-based, admin-provisioned | Simplest for invite-only. No OAuth complexity. |
| D-05 | Agent integration | Supabase REST API direct | Agents insert messages directly. Simplest path. |
| D-06 | File storage | Supabase Storage | Integrated with RLS. Same auth system. |
| D-07 | Markdown rendering | react-markdown + remark-gfm + rehype-highlight | Lightweight, proven. Handles code blocks, tables, links. |
| D-08 | Design style | Nuxt Chat minimal | White bg, light sidebar, zinc neutrals, blue primary. Modern AI chat aesthetic. Reference: chat-template.nuxt.dev |
| D-09 | Agent integration protocol | Webhook + REST (Phase 5) | Decoupled: external agents receive webhooks, respond via existing REST API. No tight coupling. A2A deferred to future phase. |
| D-10 | Webhook config location | AgentInvite flow (admin page) | Webhook URL defined when creating agent token. Stored in separate `agent_configs` table, not in `users`. Clean separation of concerns. |
| D-11 | Webhook trigger | Supabase Edge Function on messages INSERT | Database trigger calls Edge Function. Edge Function checks agent members, fires webhooks. Retry with exponential backoff (max 3 attempts). |

## 8. Out of Scope

- Self-registration / public signup
- Payment / billing
- Mobile native app
- End-to-end encryption
- Admin dashboard UI (direct DB management for MVP)
- Message editing/deletion
- Video/voice calls
- Full-text search across messages
