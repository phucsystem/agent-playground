# System Architecture

**Last updated:** 2026-03-17

## Overview

Agent Playground is a chat-based collaboration platform where humans and AI agents work together through conversations with easy API integration via webhooks. Future direction: more tools and public agents.

**Stack:** Next.js 16 (React 19) | Supabase (PostgreSQL, Realtime, Auth, Storage, Edge Functions) | Tailwind CSS 4

## System Diagram

```mermaid
graph TB
    subgraph Client["Browser Client"]
        NextJS["Next.js Frontend<br/>React 19 + TypeScript"]
        Pages["Pages: Login, Setup, Chat, Admin"]
        Hooks["13 Custom Hooks"]
        Components["24 Components"]
    end

    subgraph Supabase["Supabase Cloud"]
        PostgREST["PostgREST API"]
        RealtimeWS["Realtime WebSocket"]
        PostgreSQL[("PostgreSQL<br/>8 Tables + RLS")]
        Storage["Storage Bucket"]
        Auth["Auth (JWT)"]
        DBWebhook["Database Webhook Trigger"]
        EdgeFn["Edge Function:<br/>webhook-dispatch"]
    end

    subgraph External["External Services"]
        AgentSvc["Agent Services<br/>(via Webhooks)"]
    end

    NextJS --> PostgREST
    NextJS --> RealtimeWS
    NextJS --> Storage
    NextJS --> Auth

    PostgREST --> PostgreSQL
    RealtimeWS --> PostgreSQL
    Storage --> PostgreSQL

    PostgreSQL -->|"messages INSERT"| DBWebhook
    DBWebhook -->|POST| EdgeFn
    EdgeFn -->|"query configs"| PostgreSQL
    EdgeFn -->|"POST webhook_url"| AgentSvc
    AgentSvc -->|response| EdgeFn
    EdgeFn -->|"INSERT agent reply"| PostgreSQL
    PostgreSQL -->|Realtime broadcast| RealtimeWS
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant NextJS as Next.js API
    participant Supabase

    User->>Browser: Enter token
    Browser->>NextJS: POST /api/auth/login {token}
    NextJS->>Supabase: RPC login_with_token(token)
    Supabase-->>NextJS: JWT + user profile
    NextJS-->>Browser: Set HTTP-only cookie

    alt First login (no display_name)
        Browser->>Browser: Redirect /setup
        User->>Browser: Pick avatar + nickname
        Browser->>Supabase: RPC update_profile()
    end

    Browser->>Browser: Redirect /chat
```

**Key decisions:**
- Pre-provisioned 64-char tokens (admin-generated) — no email/password
- JWT stored in HTTP-only secure cookie
- Middleware validates JWT on every `/chat/*` and `/setup` request
- Token cached in localStorage for auto-login on revisit

## Authorization (Row Level Security)

```mermaid
flowchart LR
    Request["API Request<br/>+ JWT"] --> RLS{"RLS Policy<br/>Check"}
    RLS -->|"auth.uid()"| Helpers["SECURITY DEFINER<br/>Helper Functions"]
    Helpers --> Decision{Allowed?}
    Decision -->|Yes| Data["Return Data"]
    Decision -->|No| Deny["403 Forbidden"]
```

**SECURITY DEFINER helpers** (bypass RLS to prevent circular dependencies):

| Function | Purpose |
|----------|---------|
| `is_admin()` | Check if current user is admin |
| `my_conversation_ids()` | Get conversation IDs user belongs to |
| `is_conversation_member(conv)` | Verify membership |
| `is_conversation_admin(conv)` | Verify admin role |
| `get_conversation_members(conv)` | Return members (bypasses users RLS) |

All access control enforced at database level — no application-level authorization needed.

## Realtime Architecture

```mermaid
flowchart TB
    subgraph Channels["3 Realtime Layers"]
        PG["postgres_changes<br/>Message INSERT events<br/>< 500ms"]
        Presence["Presence Channel<br/>Online/offline sync<br/>< 2s"]
        Broadcast["Broadcast Channel<br/>Typing indicators<br/>< 100ms"]
    end

    subgraph ClientSide["Client-Side Heuristics"]
        Thinking["Agent Thinking Indicator<br/>30s timeout fallback"]
        Toasts["Presence Toasts<br/>Online notifications"]
    end

    PG --> MessageList["Message List"]
    Presence --> OnlineUsers["Online Users Sidebar"]
    Presence --> Toasts
    Broadcast --> TypingDots["Typing Indicator"]
    MessageList --> Thinking
```

| Layer | Channel | Event | Use |
|-------|---------|-------|-----|
| Postgres Changes | `messages:{convId}` | INSERT | Real-time message delivery |
| Presence | `online-users` | sync/join/leave | Online status tracking |
| Broadcast | `typing:{convId}` | typing | "User is typing..." |
| Client heuristic | — | message array watch | "Agent is thinking..." (30s timeout) |

## Data Flow: Message Sending

```mermaid
sequenceDiagram
    participant User
    participant ChatInput
    participant Supabase as Supabase DB
    participant Realtime
    participant Webhook as webhook-dispatch
    participant Agent as Agent Service

    User->>ChatInput: Type + send
    ChatInput->>Supabase: INSERT message
    Supabase->>Supabase: RLS check (is member?)
    Supabase->>Realtime: Broadcast INSERT
    Realtime-->>User: New message appears

    alt Sender is human & conversation has agents
        Supabase->>Webhook: Trigger Edge Function
        Webhook->>Webhook: Check @mentions (groups)
        Webhook->>Agent: POST webhook_url + history
        Agent-->>Webhook: {reply: "..."}
        Webhook->>Supabase: INSERT agent reply
        Supabase->>Realtime: Broadcast agent message
        Realtime-->>User: Agent reply appears
    end
```

## Webhook Dispatch Architecture

```mermaid
flowchart TD
    Trigger["Message INSERT"] --> CheckSender{"Sender is agent?"}
    CheckSender -->|Yes| Skip["Skip (prevent loops)"]
    CheckSender -->|No| CheckType{"Conversation type?"}

    CheckType -->|DM| DispatchAll["Dispatch to agent"]
    CheckType -->|Group| CheckMention{"@mention found?"}

    CheckMention -->|Yes| DispatchMentioned["Dispatch to @mentioned agents only"]
    CheckMention -->|No| SkipGroup["Skip (200 OK)"]

    DispatchAll --> BuildPayload["Build payload<br/>+ last 50 messages history"]
    DispatchMentioned --> BuildPayload

    BuildPayload --> POST["POST to webhook_url"]
    POST --> LogResult["Log to webhook_delivery_logs"]

    POST -->|"2xx"| Success["Status: delivered"]
    POST -->|"4xx"| Fail["Status: failed (no retry)"]
    POST -->|"5xx/timeout"| Retry{"Attempts < 3?"}
    Retry -->|Yes| POST
    Retry -->|No| Fail
```

**Webhook payload includes:**
- Message content, sender info, conversation metadata
- Last 50 messages as conversation history (for agent context)
- Security headers: HMAC-SHA256 signature, webhook ID, timestamp

**Retry policy:** 3 attempts max (immediate, +10s, +60s). 30s timeout per attempt.

## File Upload Architecture

```mermaid
sequenceDiagram
    participant User
    participant Hook as useFileUpload
    participant DB as Supabase DB
    participant Storage as Supabase Storage

    User->>Hook: Select file
    Hook->>DB: INSERT message (placeholder)
    Hook->>Storage: Upload to attachments/{convId}/{msgId}/{filename}
    Storage->>Storage: RLS path check (is member?)
    Hook->>DB: PATCH message metadata (file_url, size)
    DB->>DB: Realtime broadcast
```

**Storage path:** `attachments/{conversationId}/{messageId}/{filename}`
**Limits:** 10MB per file | Signed URLs (1h expiry) | RLS-enforced access

## Database Schema

```mermaid
erDiagram
    users ||--o{ conversations : creates
    users ||--o{ conversation_members : joins
    users ||--o{ messages : sends
    users ||--o{ reactions : reacts
    users ||--o| agent_configs : "has webhook"

    conversations ||--o{ conversation_members : has
    conversations ||--o{ messages : contains

    messages ||--o{ attachments : has
    messages ||--o{ reactions : has
    messages ||--o{ webhook_delivery_logs : triggers

    agent_configs ||--o{ webhook_delivery_logs : logs
```

**8 tables** with RLS on all:

| Table | Purpose |
|-------|---------|
| `users` | Humans + agents (role, token, avatar, is_mock, is_active) |
| `conversations` | DMs and groups (type, name, is_archived) |
| `conversation_members` | Membership + roles + last_read_at |
| `messages` | Chat messages (content, content_type, metadata JSONB) |
| `attachments` | File metadata (name, URL, size, storage path) |
| `reactions` | Emoji reactions (one per user per message) |
| `agent_configs` | Webhook URL + secret + active toggle (one per agent) |
| `webhook_delivery_logs` | Dispatch history (status, attempts, request/response) |

**11 migrations** applied sequentially from initial schema through conversation members function.

## Mobile Responsive Architecture

```mermaid
flowchart LR
    subgraph Desktop["Desktop (lg: 1024px+)"]
        FixedSidebar["Fixed Sidebar<br/>260px"] --- MainContent["Main Chat Area"]
    end

    subgraph Mobile["Mobile (< 768px)"]
        Hamburger["Hamburger Menu"] -->|toggle| Overlay["Slide-over Sidebar<br/>+ Backdrop"]
        Overlay -->|route change| AutoClose["Auto-close"]
    end
```

**MobileSidebarProvider** context wraps chat layout. Manages sidebar visibility, prevents body scroll when open.

## Conversation Pinning

- **Storage:** Browser localStorage (`pinned_conversations_{userId}`)
- **Behavior:** Pinned conversations sorted to top (alphabetical), unpinned sorted by recency
- **Scope:** Client-side preference, not synced across devices

## Presence Toasts

- **Trigger:** `use-supabase-presence` detects new online users (humans only, skip self/agents)
- **Display:** Sonner toast with avatar + "User is now online"
- **Latency:** < 2s from status change

## Screen Flow

```mermaid
flowchart TD
    Login["S-01: Login<br/>(token entry)"] --> Setup["S-07: Setup<br/>(avatar + nickname)"]
    Login --> Chat["S-02: Main Layout<br/>(sidebar + chat)"]
    Setup --> Chat

    Chat --> DM["S-03: DM Chat"]
    Chat --> Group["S-04: Group Chat"]
    Chat --> Info["S-05: Chat Info Panel"]
    Chat --> Admin["S-06: Admin Page"]
    Admin --> Webhooks["S-08: Webhook Logs"]
```

## Security Summary

| Area | Status | Details |
|------|--------|---------|
| Authentication | Secure | Pre-provisioned tokens, JWT in HTTP-only cookie |
| Authorization | Secure | RLS on all tables, SECURITY DEFINER helpers |
| File access | Secure | Signed URLs, conversation-scoped paths |
| Data in transit | Secure | HTTPS + WSS |
| Data at rest | Plaintext | No encryption at rest (acceptable for MVP) |
| Rate limiting | Not implemented | Potential DoS risk at scale |
| Webhook security | HMAC-SHA256 | Signature verification available |

## Scaling Considerations

| Scale | Strategy |
|-------|----------|
| Messages | Pagination (50/page), index on (conversation_id, created_at DESC) |
| Realtime | Per-conversation channels, presence deduplication |
| Files | Signed URLs (no public access), 10MB limit |
| Webhooks | 3 retries max, 30s timeout, log retention (30-day recommended) |
| Users | RLS handles filtering, client-side caching in hooks |

**Current capacity:** < 50 concurrent users (Supabase free tier: 500 realtime connections)

## Deployment

```mermaid
flowchart LR
    Dev["Local Dev<br/>pnpm dev"] -->|"supabase db push"| Supabase["Supabase Cloud<br/>PostgreSQL + Realtime"]
    Dev -->|"deploy"| Vercel["Vercel / Host<br/>Next.js SSR"]
    Dev -->|"supabase functions deploy"| EdgeFn["Edge Function<br/>webhook-dispatch"]
```

**Checklist:** Supabase project, env vars, migrations, seed data, RLS enabled, Realtime on messages, Storage bucket, Edge Function deployed, DB webhook connected, CORS configured.

## Future Direction

- More tools integration (beyond webhooks)
- Public agent marketplace
- Project collaboration features (beyond conversations)
- Message search, editing, user blocking
