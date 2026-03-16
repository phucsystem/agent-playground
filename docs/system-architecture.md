# System Architecture

**Last updated:** 2026-03-17

## Overview

Agent Playground is a chat-based collaboration platform with easy API integration. Uses three-tier architecture: Next.js frontend (React 19), Supabase backend (PostgreSQL + Realtime), and browser WebSocket for realtime sync. Supports human-agent collaboration via webhook-based integrations.

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Next.js Frontend (React 19)                              │  │
│  │ ┌────────────────┐  ┌──────────────────────────────────┐ │  │
│  │ │ Pages          │  │ Components + Hooks               │ │  │
│  │ │ - login        │  │ - ChatInput (file upload)        │ │  │
│  │ │ - setup        │  │ - MessageList (realtime)         │ │  │
│  │ │ - admin        │  │ - Sidebar (presence, convs)      │ │  │
│  │ │ - /chat        │  │ - use-realtime-messages         │ │  │
│  │ │ - /chat/[id]   │  │ - use-supabase-presence         │ │  │
│  │ └────────────────┘  │ - use-file-upload               │ │  │
│  │                     │ - use-reactions                 │ │  │
│  │                     │ - use-typing-indicator          │ │  │
│  │                     └──────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                   │
└─────────────────────────────┼───────────────────────────────────┘
                              │ HTTP + WebSocket
         ┌────────────────────┴────────────────────┐
         │                                         │
┌────────▼─────────────────────────────────────────▼──────────────┐
│                     Supabase Cloud                               │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ PostgREST API (REST endpoints)                           │  │
│  │ - /rest/v1/messages (CRUD)                               │  │
│  │ - /rest/v1/conversations (CRUD)                          │  │
│  │ - /rest/v1/users, attachments, reactions, etc.           │  │
│  │ - /rpc/find_or_create_dm, mark_conversation_read, etc.   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                   │
│  ┌──────────────────────────▼──────────────────────────────┐   │
│  │ Realtime Subscriptions (WebSocket)                       │   │
│  │ - postgres_changes (INSERT on messages)                  │   │
│  │ - presence (online/offline sync)                         │   │
│  │ - broadcast (typing indicators — Phase 4)                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                   │
│  ┌──────────────────────────▼──────────────────────────────┐   │
│  │ PostgreSQL Database (Auth Required)                      │   │
│  │ - users, conversations, conversation_members            │   │
│  │ - messages, attachments, reactions                       │   │
│  │ - Row Level Security (RLS) policies on all tables        │   │
│  │ - Triggers (e.g., update_conversation_updated_at)        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                   │
│  ┌──────────────────────────▼──────────────────────────────┐   │
│  │ Storage (File Upload)                                    │   │
│  │ - attachments bucket                                     │   │
│  │ - Pattern: {conversation_id}/{message_id}/{filename}     │   │
│  │ - Max 10MB per file, RLS policies enforce access         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Auth (JWT Sessions)                                      │   │
│  │ - Anon key (limited READ on public policies)             │   │
│  │ - Service role key (full access — server only)           │   │
│  │ - JWT tokens in secure cookies                           │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## Authentication & Authorization

### Token-Based Login Flow

```
1. User visits /login
   ↓ localStorage check for cached token
2. If cached token exists, auto-login attempt (spinner shown)
3. If not cached or token invalid, show token entry form
4. User enters pre-provisioned token (64-char)
   ↓
5. POST /api/auth/login { token: "{64-char-token}" }
   ↓
6. Next.js API calls Supabase RPC: login_with_token(token)
   ↓
7. Supabase validates token in users table (is_active = true)
   ↓
8. Supabase Auth generates JWT (using SHA-256 password derived from userId + serviceRoleKey)
   ↓
9. Frontend receives JWT, stores in secure HTTP-only cookie
   ↓
10. Frontend saves token to localStorage (agent_playground_token key)
    ↓
11. Middleware validates JWT on every request to /chat/* or /setup
    ↓
12. If first login (display_name is null) → redirect to /setup (profile wizard)
    ↓
13. Setup page: user picks avatar (DiceBear 12 styles) + nickname (replaces placeholder email/name)
    ↓
14. POST /rpc/update_profile with avatar_url + display_name
    ↓
15. Redirect to /chat, UI renders with currentUser context
```

**Logout:** Clears localStorage token in both auth.ts::logout() and sidebar.tsx::handleLogout(). Falls back to manual token entry if cached token is invalid.

### Session Management

- **JWT Storage** — Secure HTTP-only cookie (set by Supabase)
- **Session Refresh** — Supabase handles auto-refresh via refresh token
- **Middleware Guard** — `/middleware.ts` validates JWT before allowing `/chat/*`
- **Logout** — Clears cookie via Supabase Auth

### Row Level Security (RLS)

All database operations filtered by `auth.uid()` from JWT. Uses SECURITY DEFINER helper functions to prevent RLS recursion.

**Helper Functions (SECURITY DEFINER):**

```sql
is_admin()                    -- Check if current user is admin
my_conversation_ids()         -- Get conversation IDs user is member of
is_conversation_member(conv)  -- Check if member of conversation
is_conversation_admin(conv)   -- Check if admin of conversation
```

**Why SECURITY DEFINER:** RLS policies cannot directly query other tables without causing circular dependencies. DEFINER functions execute as schema owner, bypassing RLS for internal queries.

**Example Policy (Using Helper):**

```sql
CREATE POLICY "messages_select" ON messages FOR SELECT
  USING (is_conversation_member(conversation_id));

CREATE POLICY "messages_insert" ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND is_conversation_member(conversation_id)
  );
```

**Result:** No application-level authorization needed. Database enforces all access control. Helpers prevent recursion issues.

**Mock User Filtering:**

```sql
-- Non-admin users only see non-mock users in presence list
CREATE POLICY "users_select" ON users FOR SELECT
  USING (is_active = true AND (is_mock = false OR is_admin()));
```

## Realtime Architecture

### Three Realtime Layers

#### 1. Postgres Changes (Message Delivery)

**Channel:** `messages:{conversationId}`
**Event:** INSERT on messages table
**Latency:** <500ms

```typescript
// Frontend subscribes per-conversation
supabase
  .channel(`messages:${conversationId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}`
  }, (payload) => {
    // Append new message to UI
    setMessages(prev => [...prev, payload.new])
  })
  .subscribe()
```

**Trigger:** Message INSERT → PostgreSQL publishes change → WebSocket broadcasts to subscribed clients.

#### 2. Presence (Online Status)

**Channel:** `online-users`
**Event:** presence sync/join/leave
**Latency:** <2s

```typescript
// User broadcasts when online
supabase.channel('online-users')
  .on('presence', { event: 'sync' }, () => {
    const state = presenceChannel.presenceState()
    setOnlineUsers(state)
  })
  .subscribe(async status => {
    if (status === 'SUBSCRIBED') {
      await presenceChannel.track({
        user_id: currentUser.id,
        display_name: currentUser.display_name,
        online_at: new Date().toISOString()
      })
    }
  })
```

**State:** Each user key in presence maps to an array of sessions. Shows "Alice (2 devices)" when helpful.

#### 3. Broadcast (Typing Indicators — Phase 3)

**Channel:** `typing:{conversationId}`
**Event:** broadcast typing
**Latency:** <100ms

```typescript
// Debounced while user types
supabase.channel(`typing:${conversationId}`)
  .send({
    type: 'broadcast',
    event: 'typing',
    payload: { user_id: currentUser.id }
  })

// Listen for others typing
supabase.channel(`typing:${conversationId}`)
  .on('broadcast', { event: 'typing' }, payload => {
    // Show "User is typing..."
  })
  .subscribe()
```

#### 4. Agent Thinking Indicator (Client-Side Heuristic)

**Hook:** `use-agent-thinking.ts`
**Trigger:** User sends message in agent DM conversation
**State:** `agentThinking: true` → `false` when agent reply arrives or 30s timeout
**Display:** "Agent is thinking..." with bouncing dots animation

```typescript
// Hook watches message array
const { agentThinking } = useAgentThinking(conversation.other_user?.is_agent)

// When user sends message → agentThinking = true
// When agent message arrives → agentThinking = false
// 30s timeout fallback (matches webhook timeout)

// TypingIndicator component displays
{agentThinking && <TypingIndicator message="Agent is thinking..." />}
```

**Why client-side?** No backend involvement. Agent messages may arrive via webhook dispatch or direct REST API. Client watches message stream and sets flag optimistically.

## Data Flow Patterns

### Sending a Text Message

```
User Types Message
  ↓
ChatInput Component onSubmit
  ↓
Call hook.sendMessage(content)
  ↓
Hook calls supabase.from('messages').insert({
  conversation_id,
  sender_id: currentUser.id,
  content,
  content_type: 'text'
})
  ↓
INSERT triggers RLS policy (verifies sender is in conversation)
  ↓
INSERT succeeds → conversation.updated_at timestamp updates
  ↓
PostgreSQL broadcasts INSERT change via Realtime
  ↓
All subscribed clients receive message instantly
  ↓
MessageList renders new message (optimistic + server-confirmed)
```

**UI: Optimistic Updates** — Components add message immediately while POST in flight. Confirmed on server response.

### Uploading a File

```
User Selects File in ChatInput
  ↓
Calls useFileUpload(file)
  ↓
Hook creates placeholder message with content_type: 'file'
  ↓
Hook uploads to Storage at path: attachments/{conversationId}/{messageId}/{filename}
  ↓
Hook updates message.metadata with {file_name, file_size, file_url}
  ↓
RLS policy allows upload if (storage.foldername(name))[1] is user's conversation
  ↓
Upload succeeds → message visible to all conversation members
  ↓
Component detects content_type: 'file' → renders FileCard with download link
```

**Optimization:** File URL stored in message.metadata, accessible directly from message record.

### Creating a Group Conversation

```
User clicks "New Group" in Sidebar
  ↓
CreateGroupDialog opens, user selects members + name
  ↓
Dialog calls create_group_dialog.submit()
  ↓
Step 1: POST /rest/v1/conversations { type: 'group', name: 'test-agents' }
  ↓
Step 2: POST /rest/v1/conversation_members [
  { conversation_id, user_id: creator, role: 'admin' },
  { conversation_id, user_id: member1, role: 'member' },
  { conversation_id, user_id: member2, role: 'member' }
]
  ↓
RLS verifies creator has admin role
  ↓
Sidebar updates via use-conversations hook
  ↓
All members see group in conversation list instantly (realtime sync optional)
```

## File Upload Architecture

### Storage Structure

```
Bucket: attachments
├── {conversation-uuid-1}/
│   ├── {message-uuid-1}/
│   │   ├── report.pdf
│   │   └── screenshot.png
│   └── {message-uuid-2}/
│       └── data.csv
└── {conversation-uuid-2}/
    └── ...
```

**Path Pattern:** `attachments/{conversationId}/{messageId}/{filename}`

**Security:** RLS policy ensures user can only access files in their conversation folders.

### Upload Flow

1. **File Input Change** → triggers `useFileUpload`
2. **Create Message Record** → POST with placeholder content
3. **Upload to Storage** → `/storage/v1/object/attachments/{path}` with JWT header
4. **Generate Signed URL** → `createSignedUrl(path, 3600)` for secure 1-hour expiry
5. **Update Message Metadata** → PATCH message with signed_url, file_size, etc.
6. **Realtime Triggers** → postgres_changes broadcasts updated message
7. **Render Component** → MessageItem checks content_type, renders FileCard or ImagePreview

**Security:** Uses signed URLs instead of public URLs. Paths scoped to conversation via RLS policy using `my_conversation_ids()` helper.

### Supported File Types

| Type | Extensions | Max Size | Preview |
|------|-----------|----------|---------|
| **Image** | jpg, png, gif, webp | 10 MB | Thumbnail + lightbox |
| **Document** | pdf, txt, md, csv | 10 MB | File card + download |

## Message Types & Rendering

| content_type | metadata | Render As | Example |
|---|---|---|---|
| `text` | null | Markdown (react-markdown) | "**Bold** and code blocks" |
| `file` | {file_name, file_size, file_type, file_url} | FileCard (download link) | "report.pdf (2.4 MB)" |
| `image` | {file_name, width, height, file_size} | ImagePreview (thumbnail → lightbox) | "photo.png (1200x800)" |
| `url` | {og_title, og_description, og_image, favicon} | URLPreview (card with metadata) | "Example Article — example.com" |

**Component Logic:** MessageItem renders based on content_type, delegating to specialized sub-components.

**Message Reactions (Phase 3):**

| metadata field | Example | Use |
|---|---|---|
| `reactions` | `[{user_id, emoji, created_at}]` | Store one reaction per user per message |

Clients listen via `use-reactions` hook. Realtime broadcast updates reaction counts on messages.

## Admin User Management Flow

```
Admin logs in
    ↓
Sidebar shows "Admin" option (role = 'admin')
    ↓
Click /admin
    ↓
Admin Page shows:
  ├── User list (sortable by name, email, role)
  ├── Inline actions:
  │   ├── Copy Token (show in modal, copy to clipboard)
  │   ├── Toggle Enable/Disable (immediate, affects user presence)
  │   └── Delete User (confirm, remove from all conversations)
  └── Auto-refresh on user changes (via realtime subscription)
```

**Security:** RLS policy `users_delete_admin` only admins can delete. `is_admin()` helper verifies role.

## Profile Setup & Onboarding Flow

```
Login successful (first-time user)
    ↓
Middleware detects `display_name = NULL`
    ↓
Redirect to /setup
    ↓
Setup Page displays:
  ├── Step 1: Avatar picker (DiceBear 12 styles)
  │   ├── Adventurer, Bottts, Lorelei, Avataaars, etc.
  │   └── Live preview as user selects
  ├── Step 2: Nickname entry (max 32 chars)
  │   └── Live preview below input
  └── Complete button (POST /rpc/update_profile)
    ↓
POST { display_name, avatar_url }
    ↓
Middleware checks display_name again
    ↓
If set → redirect to /chat
    ↓
User sees conversations, can start chatting
```

**Avatar URLs:** Generated via `https://api.dicebear.com/9.x/{style}/svg?seed={nickname}`

## Conversation Types

### DM (1:1)

- **Participants:** 2 (human + human, or human + agent)
- **Created by:** Either participant (find_or_create_dm function)
- **Access:** Both must be conversation members (RLS enforces)
- **Name:** NULL (displayed as other user's name)
- **Admin:** First creator is admin

### Group (3+)

- **Participants:** 3 or more (any combo of humans + agents)
- **Created by:** One user (stored in created_by)
- **Members:** Added post-creation
- **Name:** Required (displayed in header)
- **Roles:** admin (can add/remove members) or member (read-only)
- **Admin:** Group creator is admin by default

## Component Interaction Flow

```
Login Page (login/page.tsx)
  └─ TokenInput form
     └─ POST /api/auth/login
        └─ Set JWT cookie
           ↓
Chat Layout (chat/layout.tsx)
  ├─ Sidebar (sidebar.tsx)
  │  ├─ UserProfile (current user + logout)
  │  ├─ OnlineUsers (presence list)
  │  │  └─ Click to start DM → find_or_create_dm
  │  ├─ ConversationList (all conversations)
  │  │  └─ Click to open conversation
  │  └─ CreateGroupDialog (modal to create group)
  │     └─ Select members → POST /conversations + /conversation_members
  └─ Main Chat Area
     ├─ Empty State (no conversation selected)
     └─ Chat Page (chat/[conversationId]/page.tsx)
        ├─ ChatHeader (title + member count)
        ├─ MessageList (infinite scroll)
        │  ├─ use-realtime-messages hook
        │  │  └─ Subscribe to postgres_changes
        │  └─ MessageItem (individual message)
        │     ├─ Markdown (text messages)
        │     ├─ ImagePreview (image content_type)
        │     ├─ FileCard (file content_type)
        │     └─ URLPreview (url content_type)
        ├─ ChatInput (text + file input)
        │  └─ useFileUpload hook
        │     └─ Storage upload + metadata
        └─ ChatInfoPanel (slide-over)
           ├─ Members list (from use-conversation-members)
           └─ Attachments list (by message)

Admin Page (admin/page.tsx) — Phase 4
  ├─ User management table
  │  └─ Copy token, toggle enable/disable, delete user
  └─ Webhook admin page link

Webhook Admin (admin/webhooks/page.tsx) — Phase 5
  ├─ use-agent-configs hook
  │  └─ Fetch/update webhook configs per agent
  ├─ Agent webhook config table
  │  ├─ Webhook URL input + save
  │  ├─ Toggle webhook active/inactive
  │  └─ View delivery logs link
  └─ Webhook delivery logs (expandable)
     └─ use-webhook-logs hook
        └─ Fetch logs with filters (agent, status, time range)
```

## Hook Lifecycle

### useRealtimeMessages

```
1. Mount with conversationId
2. Fetch initial messages (limit 50, paginated)
3. Subscribe to postgres_changes INSERT on messages table
4. On new INSERT: append to state
5. On manual pagination: fetch earlier messages via offset
6. Unmount: unsubscribe from channel
```

### useSupabasePresence

```
1. Mount with currentUser
2. Subscribe to 'online-users' channel
3. On SUBSCRIBED: track self with payload
4. Listen to presence sync/join/leave
5. Update onlineUsers state
6. Unmount: untrack self, unsubscribe
```

### useFileUpload

```
1. User selects file from input
2. Generate new message ID
3. POST message with content_type: 'file'
4. Upload file to Storage (attachments/{conversationId}/{messageId}/{filename})
5. If successful: update message metadata with file_url
6. Return { isLoading, error }
```

## Database Functions (RPC)

### login_with_token(token)

- **Input:** `token: text`
- **Output:** JWT + user profile
- **Logic:** Finds user by token, checks is_active, generates JWT
- **Called from:** API route `/api/auth/login`

### find_or_create_dm(other_user_id)

- **Input:** `other_user_id: uuid`
- **Output:** `conversation_id: uuid`
- **Logic:** Searches for existing DM between auth.uid() and other_user_id; creates if missing
- **Idempotent:** Safe to call repeatedly for same pair

### get_my_conversations()

- **Input:** (none)
- **Output:** Array of conversations with last message preview + unread count
- **Logic:** Joins conversations, members, last message, unread count
- **Called from:** use-conversations hook

### get_unread_counts()

- **Input:** (none)
- **Output:** Array of {conversation_id, unread_count}
- **Logic:** Counts messages created after last_read_at
- **Used by:** Conversation list badge

### mark_conversation_read(conv_id)

- **Input:** `conv_id: uuid`
- **Output:** void
- **Logic:** Sets conversation_members.last_read_at = now() for current user
- **Called from:** ChatPage on mount

## Error Handling

### Authentication Errors

| Error | Cause | Handling |
|-------|-------|----------|
| 401 Invalid token | Token not in DB | Show error, ask user to verify token |
| 403 Account disabled | is_active = false | Show error, contact admin |
| 401 Session expired | JWT expired | Redirect to login |

### Database Errors

| Error | Cause | Handling |
|-------|-------|----------|
| 409 Duplicate | DM already exists | Return existing conversation |
| 403 RLS violation | Not conversation member | Show "Not authorized" |
| 400 Invalid input | Missing required fields | Validate client-side first |

### File Upload Errors

| Error | Cause | Handling |
|-------|-------|----------|
| 413 Payload too large | File > 10MB | Show size warning before upload |
| 403 Storage auth failed | Not in conversation | Gracefully fail upload |
| 400 Invalid MIME type | Unsupported file format | Reject before upload |

## Security Considerations

### Authentication

- ✅ Token stored uniquely per user (UUID v4)
- ✅ JWT in secure, HTTP-only cookie
- ✅ Middleware validates JWT before /chat/* access
- ✅ Session refresh automatic (Supabase handles)

### Authorization

- ✅ RLS policies enforce all access control
- ✅ Users can only read/write own conversations
- ✅ File access restricted to conversation members
- ✅ No service role key exposed to frontend

### Data Protection

- ✅ Messages encrypted in transit (HTTPS)
- ✅ Files stored with conversation-scoped paths
- ✅ No PII in logs (timestamps only)
- ✅ Message content is plaintext (no encryption at rest yet)

### Denial of Service

- ⚠️ No rate limiting on messages API
- ⚠️ No message size limits (could store 1GB in one message)
- ⚠️ File upload limit: 10MB (enforced)
- **Mitigation:** Monitor Supabase usage, set budget alerts

## Monitoring & Observability

### Logs to Check

- **Middleware:** Rejected auth attempts at `/middleware.ts`
- **API Routes:** Token exchange successes/failures
- **Browser Console:** WebSocket connection errors, subscription failures
- **Supabase Logs:** RLS policy failures, slow queries

### Metrics to Track

- Active users online (from presence state)
- Messages per hour (database query)
- File upload volume (Storage metrics)
- Realtime subscription count (Supabase dashboard)

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Messages not loading | RLS policy too strict | Verify conversation_members join |
| Presence always empty | WebSocket blocked | Check browser DevTools → Network |
| File upload fails | Storage path mismatch | Verify path pattern in code |
| JWT always expires | Refresh token broken | Check cookie domain settings |

## Webhook Dispatch Architecture (Phase 5) — Updated with @Mention Routing & Debug Logging

### Flow Diagram

```mermaid
sequenceDiagram
    participant Human
    participant Chat UI
    participant Supabase DB
    participant DB Webhook
    participant Edge Function
    participant Agent Service

    Human->>Chat UI: Send message
    Chat UI->>Supabase DB: INSERT messages
    Supabase DB->>DB Webhook: INSERT event trigger
    DB Webhook->>Edge Function: POST /webhook-dispatch
    Edge Function->>Supabase DB: Query sender (is_agent?)
    alt Sender is agent
        Edge Function-->>Edge Function: Skip (prevent loops)
    else Sender is human
        Edge Function->>Supabase DB: Query agent_configs
        Edge Function->>Supabase DB: INSERT webhook_delivery_logs (pending)
        Edge Function->>Agent Service: POST webhook_url {message, sender, conversation_id}
        Agent Service-->>Edge Function: {reply: "..."}
        Edge Function->>Supabase DB: UPDATE log (delivered)
        Edge Function->>Supabase DB: INSERT messages (agent reply)
        Supabase DB-->>Chat UI: Realtime: new message
    end
```

### System Overview with Webhooks

```mermaid
flowchart TD
    Browser[Browser Client]
    NextJS[Next.js Frontend]
    Supabase[Supabase Cloud]
    PostgREST[PostgREST API]
    Realtime[Realtime WebSocket]
    PostgreSQL[(PostgreSQL)]
    Storage[Storage Bucket]
    Auth[Auth JWT]
    DBWebhook[Database Webhook]
    EdgeFn[Edge Function: webhook-dispatch]
    AgentSvc[External Agent Service]

    Browser --> NextJS
    NextJS --> PostgREST
    NextJS --> Realtime
    NextJS --> Storage
    NextJS --> Auth

    PostgREST --> PostgreSQL
    Realtime --> PostgreSQL
    Storage --> PostgreSQL

    PostgreSQL -->|messages INSERT| DBWebhook
    DBWebhook -->|POST| EdgeFn
    EdgeFn -->|query agent_configs| PostgreSQL
    EdgeFn -->|POST webhook_url| AgentSvc
    AgentSvc -->|response| EdgeFn
    EdgeFn -->|INSERT agent reply| PostgreSQL
    PostgreSQL -->|Realtime| Browser

    subgraph Supabase
        PostgREST
        Realtime
        PostgreSQL
        Storage
        Auth
        DBWebhook
        EdgeFn
    end
```

### Webhook Configuration (Admin Setup)

Admin sets webhook via `/admin` page (S-06):

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `webhook_url` | string | Yes | `https://my-agent.example.com/webhook` |
| `webhook_secret` | string | No | `whsec_abc123def456` |
| `is_webhook_active` | boolean | Yes | `true` |

Stored in `agent_configs` table (one per agent). Created when admin checks "Is agent?" during token generation.

### Agent Request/Response Format

**Webhook POST request to agent:**

```json
{
  "event": "message.created",
  "timestamp": "2026-03-16T10:33:00Z",
  "message": {
    "id": "msg-uuid",
    "conversation_id": "conv-uuid",
    "sender_id": "human-uuid",
    "sender_name": "Phuc",
    "sender_is_agent": false,
    "content": "Help me with this code snippet",
    "content_type": "text",
    "metadata": null,
    "created_at": "2026-03-16T10:33:00Z"
  },
  "conversation": {
    "id": "conv-uuid",
    "type": "dm",
    "name": null,
    "member_count": 2,
    "history": [
      {
        "id": "msg-uuid-1",
        "sender_name": "Phuc",
        "content": "Earlier message",
        "created_at": "2026-03-16T10:30:00Z"
      }
    ]
  },
  "agent": {
    "id": "agent-uuid",
    "display_name": "Claude",
    "webhook_config_id": "config-uuid"
  }
}
```

**Security headers:**

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `X-Webhook-Signature` | `sha256={HMAC-SHA256(payload, secret)}` (if secret set) |
| `X-Webhook-ID` | `{delivery_log_id}` |
| `X-Webhook-Timestamp` | `{unix_timestamp}` |
| `User-Agent` | `AgentPlayground-Webhook/1.0` |

**Expected agent response:**

- `200-299` → marked `delivered`
- `4xx` → no retry (client error)
- `5xx` or timeout → retry per policy

### Retry Policy

| Attempt | Delay | Timeout |
|---------|-------|---------|
| 1 | immediate | 30s |
| 2 | 10s | 30s |
| 3 | 60s | 30s |

After 3 failed attempts, marked `failed`. No further retries.

### Loop Prevention & @Mention Routing

**Group conversations only dispatch to @mentioned agents:**

In group conversations with multiple agents, webhook-dispatch queries the message content for agent @mentions (case-insensitive match against agent display_name). Only agents that are explicitly mentioned receive the webhook.

**Example:**
- Message: "@Claude can you help?" → Only Claude's webhook fires
- Message: "Hey everyone" (no @mention) → No webhooks fire (skip)
- Message: "Claude" (not @mention format) → No webhooks fire

**DM conversations dispatch to all agents:** Single-agent DMs always fire the webhook (no @mention needed).

**Skip conditions:**
- Messages sent by agents (`is_agent = true`) — unless @mentioned
- Inactive webhooks (`is_webhook_active = false`)
- Group conversations with no @mentions → respond with "No agents mentioned" (200)

This prevents infinite loops and reduces noisy dispatches in multi-agent groups.

### Webhook Delivery Logging

All deliveries logged to `webhook_delivery_logs` table:

| Column | Value |
|--------|-------|
| `message_id` | The message that triggered webhook |
| `agent_id` | Agent whose webhook was called |
| `status` | `pending`, `delivered`, or `failed` |
| `http_status` | HTTP response code (if available) |
| `attempt_count` | Number of attempts (max 3) |
| `last_error` | Error message from last failed attempt |
| `created_at` | When webhook was first triggered |
| `delivered_at` | When delivery succeeded (or NULL) |

Admin views logs via `/admin/webhooks` (S-08) with filters by agent, status, and time range.

---

## Scaling Considerations

### Current Limits (Seed Data)

- 6 users (2 human, 2 agent, 1 admin, 1 mock)
- 2 conversations (1 DM, 1 group)
- 10 messages total
- 2 agent webhook configs
- <100 KB storage used

### At 1,000 Users

- Database size: ~10 MB (rough)
- Realtime connections: <1,000 (Supabase free: 500)
- Message throughput: <1,000/day (well within limits)
- Webhook delivery logs: ~100/day (manageable)

### Scaling Strategies

1. **Pagination:** Load 50 messages, cache earlier (already implemented)
2. **Indexing:** Multi-column indexes on (conversation_id, created_at DESC)
3. **Caching:** Client-side hook caching reduces API calls
4. **Sharding:** Not needed <100K messages
5. **Archive:** Move old conversations to read-only archive table
6. **Log retention:** Auto-delete webhook logs older than 30 days

## Deployment Checklist

- [ ] Supabase project created (production tier if $)
- [ ] Environment variables set (.env.local)
- [ ] Database migrations run (supabase db push)
- [ ] Seed data loaded (seed.sql)
- [ ] RLS policies enabled
- [ ] Realtime enabled on messages table
- [ ] Storage bucket created with policies
- [ ] Edge Function deployed (webhook-dispatch)
- [ ] Database webhook connected to Edge Function
- [ ] CORS configured for domain
- [ ] Next.js build succeeds (npm run build)
- [ ] Test login with seed token
- [ ] Test message sending
- [ ] Test file upload
- [ ] Test webhook delivery (via admin page)
- [ ] Monitor Supabase dashboard for errors

## Recent Enhancements (Post-Phase 5)

### Mobile Responsive Layout
- **Provider:** MobileSidebarProvider context wraps chat/layout.tsx
- **Behavior:** Sidebar collapses on mobile (sm: breakpoint), toggles via hamburger menu
- **State:** useMobileSidebar hook manages visibility
- **Responsive:** Breakpoints at sm (640px), md (768px), lg (1024px)

### Conversation Pinning
- **Storage:** Browser localStorage (`pinned_conversations_{userId}`)
- **Hook:** usePinnedConversations manages read/write operations
- **UI:** Sidebar sorts pinned conversations to top of list
- **Note:** Client-side preference, not synced across devices/browsers

### Presence Toasts
- **Component:** presence-toast.tsx displays online/offline status changes
- **Library:** Sonner for dismissible notifications
- **Trigger:** use-supabase-presence detects status changes via Presence API
- **Payload:** User ID, display name, avatar, status (online/offline)
- **Latency:** <2s from status change to toast display

### Conversation History in Webhooks
- **Payload:** conversation.history array includes recent message thread
- **Use Case:** Agents receive context for better responses
- **Format:** Includes message ID, sender name, content, timestamp
- **Benefit:** Reduces need for agent to query conversation history

## Next Steps

- Phases 1-5 complete + mobile/pinning/presence enhancements.
- Future direction: more tools integration, public agents, project collaboration features
