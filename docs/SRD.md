# System Requirement Definition (SRD)

## 1. System Overview

**Project:** Agent Playground
**Purpose:** Invite-only chat platform for AI agent builders to share agents with specific testers for real-world capability verification. Supports human-to-human DM, human-to-agent DM, and group conversations with mixed participants (humans + agents).

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
| FR-01 | Token-based authentication | P1 | User enters a pre-provisioned token to log in. System validates token against `users` table, checks `is_active` flag. No self-registration. | S-01 |
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
| FR-20 | Profile setup wizard | P4 | New users complete avatar selection (DiceBear 12 styles) and nickname entry. Shown on first login at /setup. | S-07 |
| FR-21 | Mock user flag | P4 | Admins can mark users as mock. Non-admin users see only non-mock users in presence list. | S-02, S-06 |

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

## 5. Entity List (E-xx)

| ID | Entity | Description | Key Fields |
|----|--------|-------------|------------|
| E-01 | `users` | Human users and agents | `id` (uuid, PK), `email` (text, unique), `display_name` (text), `avatar_url` (text, nullable), `role` (enum: admin/user/agent), `is_mock` (bool, default false), `is_active` (bool, default true), `token` (text, unique), `last_seen_at` (timestamptz) |
| E-02 | `conversations` | DM or group container | `id` (uuid, PK), `type` (enum: dm/group), `name` (text, nullable — null for DMs), `created_by` (uuid, FK → users), `created_at` (timestamptz) |
| E-03 | `conversation_members` | Membership join table | `conversation_id` (uuid, FK), `user_id` (uuid, FK), `joined_at` (timestamptz), `role` (enum: admin/member), PK: (conversation_id, user_id) |
| E-04 | `messages` | Chat messages | `id` (uuid, PK), `conversation_id` (uuid, FK), `sender_id` (uuid, FK → users), `content` (text), `content_type` (enum: text/file/image/url), `metadata` (jsonb, nullable), `created_at` (timestamptz) |
| E-05 | `attachments` | Files linked to messages | `id` (uuid, PK), `message_id` (uuid, FK), `file_name` (text), `file_url` (text), `file_type` (text), `file_size` (int), `storage_path` (text) |
| E-06 | `reactions` | Message reactions (P3) | `id` (uuid, PK), `message_id` (uuid, FK), `user_id` (uuid, FK), `emoji` (text), `created_at` (timestamptz), UNIQUE: (message_id, user_id, emoji) |

## 6. Non-Functional Requirements

### Performance
- Message delivery latency: <500ms (Supabase Realtime)
- Chat history load: <1s for 50 messages
- Presence update: <2s for online/offline transitions
- File upload: <5s for 10MB file

### Security
- Token-based auth — tokens are unique, unguessable (UUID v4)
- Row Level Security (RLS) on all tables — users can only access their own conversations
- File access restricted to conversation members via signed URLs
- No service key exposed to frontend — use Supabase anon key + RLS
- Agent tokens scoped to specific conversations

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

## 8. Out of Scope

- Self-registration / public signup
- Payment / billing
- Mobile native app
- End-to-end encryption
- Agent creation/configuration UI
- Admin dashboard UI (direct DB management for MVP)
- Message editing/deletion
- Video/voice calls
- Full-text search across messages
