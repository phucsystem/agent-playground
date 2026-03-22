# System Architecture

**Last updated:** 2026-03-23
**Version:** 1.4.0

## Overview

Agent Playground is a chat-based collaboration platform where humans and AI agents work together through conversations with easy API integration via webhooks. Future direction: more tools and public agents.

**Stack:** Next.js 16 (React 19) | Supabase (PostgreSQL, Realtime, Auth, Storage, Edge Functions) | Tailwind CSS 4 | React Query v5 (TanStack)

## Data Caching Architecture

Three-tier caching strategy eliminates blank screens and provides instant navigation across conversations and workspaces.

```mermaid
graph TB
    subgraph Disk["Persistent Storage (Browser Disk)"]
        LocalStorage["localStorage<br/>Conversations (24h TTL)<br/>Order, Pins, Workspace"]
    end

    subgraph Memory["React Query Cache (RAM)"]
        QC["QueryClient<br/>staleTime: 60s default<br/>gcTime: 30m"]
        Conversations["conversations<br/>staleTime: 30s"]
        Messages["messages<br/>staleTime: Infinity"]
        Members["members<br/>realtime sync"]
    end

    subgraph Realtime["Realtime (WebSocket)"]
        PG["postgres_changes<br/>INSERT/UPDATE/DELETE"]
        Presence["Presence<br/>Online/offline"]
        Typing["Broadcast<br/>Typing indicators"]
    end

    subgraph Server["Supabase API"]
        PostgREST["PostgREST<br/>(REST API)"]
    end

    LocalStorage -->|hydrate on page load| QC
    QC -->|stale? background refetch| PostgREST
    QC -->|setQueryData append/update| Messages
    Realtime -->|surgical cache writes| Messages
    Realtime -->|invalidate conversations| Conversations
    PostgREST -->|response| QC
```

**Layer 1: localStorage (Disk)**
- **conversations** — Cached per workspace, 24h TTL
- **workspace order** — Conversation DnD order
- **pins** — User's pinned conversations
- **active workspace** — User's workspace context
- Purpose: Cross-session persistence, instant app open

**Layer 2: React Query Cache (Memory)**
- **conversations** — staleTime 30s, background refetch on mount
- **messages** — staleTime Infinity (realtime-driven), paginated infinite query
- **members** — staleTime varies, realtime subscription
- **user** — Manual invalidation on profile change
- **Query keys scoped by workspaceId** — Conversations from workspace A don't interfere with workspace B

**Layer 3: Realtime (WebSocket)**
- **postgres_changes** — Surgical cache updates via setQueryData (append messages, refresh conversations)
- **presence** — Online status, no cache layer (ephemeral state)
- **broadcast** — Typing indicators (ephemeral state)
- **Latency:** <500ms for messages, <2s for presence

**No blank screens because:**
1. Open app → localStorage hydrates conversations immediately
2. Switch conversation → cached messages render instantly (paginated load more on scroll)
3. Switch workspace → stale conversations displayed immediately, background refetch in progress
4. Realtime updates append/update cache without full refetch

## System Diagram

```mermaid
graph TB
    subgraph Client["Browser Client (Next.js 16 + React 19)"]
        Pages["Pages: Login, Setup, Chat, Admin"]
        Components["33 Components (chat, sidebar, admin, ui, profile)"]
        Hooks["21+ Custom Hooks (React Query + realtime)"]
        Cache["React Query v5<br/>+ localStorage persister"]
        Realtime["Realtime subscriptions<br/>(6 channels per conversation)"]
    end

    subgraph Supabase["Supabase Cloud"]
        PostgREST["PostgREST API"]
        RealtimeWS["Realtime WebSocket<br/>(postgres_changes, presence, broadcast)"]
        PostgreSQL[("PostgreSQL<br/>11 Tables + RLS")]
        Storage["Storage<br/>(attachments + avatars)"]
        Auth["Auth (JWT)"]
        DBWebhook["Database Webhook Trigger"]
        EdgeFn["Edge Function:<br/>webhook-dispatch"]
    end

    subgraph External["External Services"]
        AgentSvc["Agent Services<br/>(via Webhooks)"]
    end

    Pages -->|hooks| Hooks
    Hooks -->|useQuery/invalidate| Cache
    Hooks -->|subscribe| Realtime
    Components -->|props| Pages
    Cache -->|fetch| PostgREST
    Cache -->|setQueryData append| Realtime
    Realtime -->|WebSocket| RealtimeWS

    PostgREST --> PostgreSQL
    RealtimeWS --> PostgreSQL
    Storage --> PostgreSQL
    Auth --> PostgreSQL

    PostgreSQL -->|"messages INSERT"| DBWebhook
    DBWebhook -->|POST| EdgeFn
    EdgeFn -->|"query configs"| PostgreSQL
    EdgeFn -->|"POST webhook_url"| AgentSvc
    AgentSvc -->|response| EdgeFn
    EdgeFn -->|"INSERT agent reply"| PostgreSQL
    PostgreSQL -->|broadcast changes| RealtimeWS
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
graph TB
    subgraph PerConversation["Per-Conversation (6 channels)"]
        MessagesInsert["messages:{convId}<br/>INSERT → append cache"]
        ConversationCrud["conversations:{wsId}<br/>CRUD → invalidate"]
        MembershipChanges["conversation_members:{convId}<br/>* → refresh members"]
        ReactionsEvents["reactions:{convId}<br/>* → update message"]
        TypingIndicator["typing:{convId}<br/>broadcast → UI state"]
    end

    subgraph GlobalChannels["Global (2 channels)"]
        OnlinePresence["online-users<br/>presence → UI + toasts"]
    end

    subgraph ClientSide["Client-Side Logic"]
        AgentThinking["Agent Thinking Heuristic<br/>30s timeout"]
        MessageCount["Message Count Watch"]
    end

    PerConversation -->|setQueryData| CacheLayer["React Query Cache<br/>(surgical updates)"]
    GlobalChannels -->|state update| UI["UI Components"]
    CacheLayer -->|prop updates| UI
    MessageCount -->|watch array| AgentThinking
    AgentThinking -->|timeout| ThinkingUI["Thinking Indicator"]
```

**Subscriptions per Conversation Context:**

| Channel | Event Type | Cache Handler | Use Case | Latency |
|---------|------------|----------------|----------|---------|
| `messages:{convId}` | postgres_changes INSERT | setQueryData append | New message + optimistic | <100ms |
| `conversations:{wsId}` | postgres_changes CRUD | invalidateQueries | Conv name/archived change | <500ms |
| `conversation_members:{convId}` | postgres_changes all | refresh query | Member added/removed/role | <500ms |
| `reactions:{convId}` | postgres_changes all | setQueryData update | Emoji added/removed | <100ms |
| `typing:{convId}` | broadcast message | React state | User is typing... | <50ms |
| `online-users` | presence sync/join/leave | React state | Online status display | <2s |

**Workspace-Scoped Isolation:**
- Query keys include `workspaceId` to prevent cross-workspace cache collisions
- Switching workspaces invalidates only stale conversations (preserves messages from current workspace)
- Presence only broadcasts within workspace context

**Cache Update Patterns:**
- **Append pattern:** Message INSERT → page count unchanged, just append to last page
- **Invalidate pattern:** Conversation type/membership change → full conversation refetch
- **Update pattern:** Reaction add/remove → update message object in cache
- All mutations optimistic: UI updates immediately, server sync in background

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

## Avatar Upload Architecture

```mermaid
sequenceDiagram
    participant User
    participant Dialog as AvatarEditorDialog
    participant Canvas as getCroppedImage
    participant Hook as useAvatarUpload
    participant Storage as Supabase Storage
    participant DB as Supabase DB

    User->>Dialog: Open avatar editor (Upload/Generate tabs)

    rect rgb(100, 150, 200)
    Note over Dialog,Canvas: Upload path: react-easy-crop + canvas
    User->>Dialog: Select image file
    Dialog->>Canvas: Crop + zoom params
    Canvas->>Canvas: drawImage() → WebP blob (256x256)
    end

    rect rgb(100, 150, 200)
    Note over Dialog,Hook: Or generate path: DiceBear API
    User->>Dialog: Choose style + randomize
    Dialog->>Dialog: Set avatar_url (DiceBear URL)
    end

    User->>Hook: Click Save
    Hook->>Storage: Upload blob to avatars/{userId}/avatar.webp
    Storage->>Storage: RLS check (folder matches auth.uid())
    Hook->>DB: UPDATE users SET avatar_url = public_url
    DB->>Dialog: onSaved() callback
    Dialog->>Dialog: Trigger use-current-user.refreshUser()
```

**Storage path:** `avatars/{userId}/avatar.webp` (public bucket)
**RLS Policies:** Users can upload/update own avatar only; all authenticated users can read
**Image handling:** Upload mode → canvas crop to 256x256 WebP | Generate mode → DiceBear SVG URL
**Cache-busting:** Public URL appended with `?t={timestamp}` to force fresh load
**Styles available:** 17 DiceBear styles (adventurer, avataaars, bottts, glass, identicon, pixel-art, shapes, etc.)

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

**11 tables** with RLS on all:

| Table | Purpose |
|-------|---------|
| `users` | Humans + agents (role, token, avatar_url, is_mock, is_active) |
| `conversations` | DMs and groups (type, name, is_archived) |
| `conversation_members` | Membership + roles + last_read_at |
| `messages` | Chat messages (content, content_type, metadata JSONB) |
| `attachments` | File metadata (name, URL, size, storage path) |
| `reactions` | Emoji reactions (one per user per message) |
| `agent_configs` | Webhook URL + secret + active toggle (one per agent) |
| `webhook_delivery_logs` | Dispatch history (status, attempts, request/response) |
| `workspaces` | Workspace containers (name, color) |
| `workspace_members` | Workspace membership + roles |
| `user_sessions` | Multi-device session tracking (3-session cap) |

**Storage buckets:**
- `attachments` (private) — Message files, scoped by conversation
- `avatars` (public) — User profile pictures, scoped by user ID

**20 migrations** applied sequentially from initial schema through avatar storage setup, workspace support, and realtime enablement.

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

## GoClaw Bridge Integration

Bridge API route connecting webhook-dispatch to GoClaw's persistent WebSocket connection. Each agent in `agent_configs` can optionally map to a GoClaw agent via `metadata.goclaw_agent_key`. Streaming messages are inserted into the database with `streaming_status` metadata; agent lifecycle events (run.started, tool.call, tool.result) are captured and displayed as status text.

```mermaid
sequenceDiagram
    participant User
    participant Supabase as Supabase DB
    participant EdgeFn as webhook-dispatch
    participant Bridge as /api/goclaw/bridge
    participant WS as GoClaw WebSocket
    participant Realtime as Supabase Realtime

    User->>Supabase: INSERT message
    Supabase->>EdgeFn: DB Webhook trigger
    EdgeFn->>Bridge: POST (payload + history)
    Bridge->>Bridge: Validate auth (Bearer webhook_secret)
    Bridge->>Supabase: Query agent_configs.metadata
    Bridge->>Supabase: INSERT placeholder message (streaming_status=streaming)
    Bridge->>WS: Establish/reuse singleton WS connection
    Bridge->>WS: chat.stream (with lifecycle event subscriptions)

    par Streaming Loop
        WS-->>Bridge: chunk data (on.("stream"))
        Bridge->>Supabase: PATCH message content (debounced 200ms)
    end

    par Lifecycle Events
        WS-->>Bridge: run.started
        Bridge->>Supabase: PATCH message (agent_status: "Thinking...")
        WS-->>Bridge: tool.call(toolName)
        Bridge->>Supabase: PATCH message (agent_status: "Calling: toolName")
        WS-->>Bridge: tool.result
        Bridge->>Supabase: PATCH message (agent_status: "Processing results...")
    end

    WS-->>Bridge: EOS (stream complete)
    Bridge->>Supabase: PATCH message (streaming_status=complete)
    Supabase->>Realtime: Broadcast content + status updates
    Realtime-->>User: Message appears + streams + status evolves
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `GOCLAW_URL` | GoClaw server base URL (server-side only) |
| `GOCLAW_GATEWAY_TOKEN` | Auth token for GoClaw API (server-side only) |
| `NEXT_PUBLIC_GOCLAW_URL` | GoClaw URL for admin UI auto-fill (public) |

### Setup

1. Deploy GoClaw server (or use existing)
2. Set `GOCLAW_URL` and `GOCLAW_GATEWAY_TOKEN` in `.env`
3. Set `NEXT_PUBLIC_GOCLAW_URL` in `.env` (for admin UI auto-fill)
4. Run migration `023_agent_configs_metadata.sql`
5. Create agent in Admin panel
6. Set webhook URL to `https://<your-app>/api/goclaw/bridge`
7. Set webhook secret (required for GoClaw agents)
8. Set health check URL to `https://<goclaw-server>/health`
9. Set GoClaw Agent Key to match agent key in GoClaw config
10. Send a message to test

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/goclaw/ws-client.ts` | GoClaw WebSocket client (singleton, reconnect, stream/send) |
| `src/lib/goclaw/index.ts` | Singleton client factory + export |
| `src/app/api/goclaw/bridge/route.ts` | Bridge API route (auth, streaming, lifecycle events, SSRF check) |
| `src/app/api/goclaw/test/route.ts` | Health check proxy for admin UI |
| `src/components/chat/message-item.tsx` | UI components for streaming messages (StreamingContent, AgentTextContent) |
| `supabase/migrations/023_agent_configs_metadata.sql` | Adds metadata JSONB column |

## Future Direction

- More tools integration (beyond webhooks)
- Public agent marketplace
- Project collaboration features (beyond conversations)
- Message search, editing, user blocking
