# Interface Specification (API)

**Backend:** Supabase (PostgREST auto-generated API + RPC functions + Realtime)
**Auth:** Supabase Auth (JWT via token exchange, SHA-256 password derivation)
**Base URL:** `https://{project-ref}.supabase.co`

**Password Security:** User passwords derived deterministically from `SHA-256(userId + serviceRoleKey)` for admin authentication. Not stored as plaintext.

> **Note:** Most CRUD operations use Supabase's auto-generated PostgREST API directly.
> Custom endpoints are implemented as Supabase RPC (database functions) or Edge Functions.

## 1. Endpoint Matrix

| Method | Endpoint | Feature (FR-xx) | Screen (S-xx) | Phase |
|--------|----------|-----------------|---------------|-------|
| POST | `/rpc/login_with_token` | FR-01 | S-01 | P1 |
| POST | `/auth/v1/logout` | FR-02 | S-02 | P1 |
| GET | `/rest/v1/users?is_active=eq.true` | FR-03, FR-09 | S-02 | P1 |
| GET | `/rpc/get_my_conversations` | FR-04 | S-02 | P1 |
| GET | `/rpc/get_unread_counts` | FR-04 | S-02 | P1 |
| POST | `/rpc/find_or_create_dm` | FR-05 | S-02, S-03 | P1 |
| GET | `/rest/v1/messages?conversation_id=eq.{id}` | FR-06, FR-07 | S-03, S-04 | P1 |
| POST | `/rest/v1/messages` | FR-06, FR-08, FR-14 | S-03, S-04 | P1 |
| POST | `/rpc/mark_conversation_read` | FR-17 | S-03, S-04 | P1 |
| POST | `/storage/v1/object/attachments/{path}` | FR-10 | S-03, S-04 | P2 |
| POST | `/rest/v1/attachments` | FR-10 | S-03, S-04 | P2 |
| POST | `/rest/v1/conversations` | FR-13 | S-02 | P2 |
| POST | `/rest/v1/conversation_members` | FR-13 | S-02, S-05 | P2 |
| DELETE | `/rest/v1/conversation_members` | FR-13 | S-05 | P2 |
| GET | `/rest/v1/conversation_members?conversation_id=eq.{id}` | FR-13 | S-04, S-05 | P2 |
| GET | `/rest/v1/attachments?message_id=in.({ids})` | FR-11 | S-05 | P2 |
| POST | `/rest/v1/reactions` | FR-18 | S-03, S-04 | P3 |
| DELETE | `/rest/v1/reactions?id=eq.{id}` | FR-18 | S-03, S-04 | P3 |
| GET | `/rest/v1/users_public?role=eq.admin` | FR-19 | S-06 | P4 |
| POST | `/rest/v1/users` | FR-19 | S-06 | P4 |
| PATCH | `/rest/v1/users?id=eq.{id}` | FR-19 | S-06 | P4 |
| DELETE | `/rest/v1/users?id=eq.{id}` | FR-19 | S-06 | P4 |
| PATCH | `/rest/v1/users?id=eq.{id}` | FR-20 | S-07 | P4 |
| WS | Realtime: `postgres_changes` on messages | FR-08 | S-03, S-04 | P1 |
| WS | Realtime: `presence` channel | FR-03 | S-02 | P1 |
| WS | Realtime: `broadcast` typing | FR-16 | S-03, S-04 | P3 |

## 2. Endpoint Details

---

### POST /rpc/login_with_token

**Description:** Exchange a pre-provisioned token for a Supabase Auth JWT session. Token cached in localStorage for auto-login.
**Feature:** FR-01
**Screen:** S-01
**Auth:** None (public endpoint)

**Implementation:** Supabase Edge Function

**Request:**
```json
{
  "token": "aBc1!@#$%^&*()-_=+[]{}|;:<>?xYzAbC1!@#$%^&*()-_=+[]{}|;:<>?xYzAbC1"
}
```

**Note:** Token is 64-character string with full charset (A-Za-z0-9!@#$%^&*()-_=+[]{}|;:<>?) generated via crypto.getRandomValues.

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "v1.abc123...",
  "user": {
    "id": "uuid",
    "email": "alice@example.com",
    "display_name": "Alice",
    "avatar_url": null,
    "is_agent": false
  }
}
```

**Errors:**
| Code | Body | Condition |
|------|------|-----------|
| 401 | `{ "error": "invalid_token", "message": "Invalid or expired token" }` | Token not found in users table |
| 403 | `{ "error": "account_disabled", "message": "Your account has been disabled" }` | `is_active = false` |

**Edge Function logic:**
1. Query `users` table for matching `token` where `is_active = true`
2. If not found → 401
3. If found but `is_active = false` → 403
4. Call `supabase.auth.admin.createUser()` or `signInWithPassword()` to generate JWT
5. Return JWT + user profile

---

### GET /rest/v1/users?is_active=eq.true

**Description:** List all active users (for presence sidebar and DM creation).
**Feature:** FR-03, FR-09
**Screen:** S-02
**Auth:** Bearer JWT

**Query params:**
| Param | Value | Purpose |
|-------|-------|---------|
| `is_active` | `eq.true` | Only active users |
| `select` | `id,display_name,avatar_url,is_agent,last_seen_at` | Limit fields |

**Response (200):**
```json
[
  {
    "id": "uuid-1",
    "display_name": "Alice",
    "avatar_url": "https://...",
    "is_agent": false,
    "last_seen_at": "2026-03-16T10:30:00Z"
  },
  {
    "id": "uuid-2",
    "display_name": "Claude-Agent",
    "avatar_url": null,
    "is_agent": true,
    "last_seen_at": "2026-03-16T10:32:00Z"
  }
]
```

**RLS:** `users_select` policy — returns all active users.

---

### GET /rpc/get_my_conversations

**Description:** Get all conversations the current user is a member of, with last message preview.
**Feature:** FR-04
**Screen:** S-02
**Auth:** Bearer JWT

**Response (200):**
```json
[
  {
    "id": "conv-uuid-1",
    "type": "dm",
    "name": null,
    "updated_at": "2026-03-16T10:33:00Z",
    "other_user": {
      "id": "uuid-2",
      "display_name": "Claude-Agent",
      "avatar_url": null,
      "is_agent": true
    },
    "last_message": {
      "content": "Here's the analysis you requested...",
      "sender_name": "Claude-Agent",
      "created_at": "2026-03-16T10:33:00Z"
    },
    "unread_count": 2
  },
  {
    "id": "conv-uuid-2",
    "type": "group",
    "name": "test-agents",
    "updated_at": "2026-03-16T10:32:00Z",
    "member_count": 5,
    "last_message": {
      "content": "@GPT-4 can you summarize this doc?",
      "sender_name": "Bob",
      "created_at": "2026-03-16T10:32:00Z"
    },
    "unread_count": 0
  }
]
```

**Implementation:** Database function that joins conversations, conversation_members, messages, and users.

---

### POST /rpc/find_or_create_dm

**Description:** Find existing DM with a user or create one.
**Feature:** FR-05
**Screen:** S-02, S-03
**Auth:** Bearer JWT

**Request:**
```json
{
  "other_user_id": "uuid-of-other-user"
}
```

**Response (200):**
```json
{
  "conversation_id": "conv-uuid"
}
```

---

### GET /rest/v1/messages

**Description:** Load message history for a conversation (paginated).
**Feature:** FR-06, FR-07
**Screen:** S-03, S-04
**Auth:** Bearer JWT

**Query params:**
| Param | Value | Purpose |
|-------|-------|---------|
| `conversation_id` | `eq.{uuid}` | Filter by conversation |
| `select` | `*,sender:users(id,display_name,avatar_url,is_agent)` | Join sender profile |
| `order` | `created_at.desc` | Newest first |
| `limit` | `50` | Page size |
| `offset` | `0` | Pagination offset |

**Response (200):**
```json
[
  {
    "id": "msg-uuid-1",
    "conversation_id": "conv-uuid",
    "sender_id": "uuid-2",
    "content": "Here's the analysis you requested:\n\n```python\ndef analyze(data):\n    return data.describe()\n```",
    "content_type": "text",
    "metadata": null,
    "created_at": "2026-03-16T10:32:00Z",
    "sender": {
      "id": "uuid-2",
      "display_name": "Claude-Agent",
      "avatar_url": null,
      "is_agent": true
    }
  }
]
```

**RLS:** `messages_select` policy — only messages in user's conversations.

---

### POST /rest/v1/messages

**Description:** Send a new message. Used by both UI and agents (FR-14).
**Feature:** FR-06, FR-08, FR-14
**Screen:** S-03, S-04
**Auth:** Bearer JWT

**Request:**
```json
{
  "conversation_id": "conv-uuid",
  "sender_id": "auth-user-uuid",
  "content": "Hello! Can you help me with this?",
  "content_type": "text",
  "metadata": null
}
```

**File message (after upload):**
```json
{
  "conversation_id": "conv-uuid",
  "sender_id": "auth-user-uuid",
  "content": "requirements.pdf",
  "content_type": "file",
  "metadata": {
    "file_name": "requirements.pdf",
    "file_size": 2457600,
    "file_type": "application/pdf",
    "file_url": "https://{project}.supabase.co/storage/v1/object/public/attachments/conv-uuid/msg-uuid/requirements.pdf"
  }
}
```

**Image message (after upload):**
```json
{
  "conversation_id": "conv-uuid",
  "sender_id": "auth-user-uuid",
  "content": "screenshot.png",
  "content_type": "image",
  "metadata": {
    "file_name": "screenshot.png",
    "file_size": 150000,
    "file_type": "image/png",
    "width": 1200,
    "height": 800,
    "file_url": "https://{project}.supabase.co/storage/v1/object/public/attachments/conv-uuid/msg-uuid/screenshot.png"
  }
}
```

**URL message:**
```json
{
  "conversation_id": "conv-uuid",
  "sender_id": "auth-user-uuid",
  "content": "https://example.com/article",
  "content_type": "url",
  "metadata": {
    "og_title": "Example Article",
    "og_description": "An interesting read about...",
    "og_image": "https://example.com/og.jpg",
    "favicon": "https://example.com/favicon.ico"
  }
}
```

**Response (201):**
```json
{
  "id": "msg-uuid",
  "conversation_id": "conv-uuid",
  "sender_id": "auth-user-uuid",
  "content": "Hello! Can you help me with this?",
  "content_type": "text",
  "metadata": null,
  "created_at": "2026-03-16T10:33:00Z"
}
```

**RLS:** `messages_insert` policy — sender must be auth user and member of conversation.

**Side effect:** Triggers `update_conversation_updated_at` to update conversation sort order.

**Realtime:** Insert triggers `postgres_changes` event → all subscribed clients receive the new message.

---

### POST /storage/v1/object/attachments/{path}

**Description:** Upload a file to Supabase Storage.
**Feature:** FR-10
**Screen:** S-03, S-04
**Auth:** Bearer JWT

**Request:** `multipart/form-data` with file body
**Path:** `attachments/{conversation_id}/{message_id}/{filename}`

**Response (200):**
```json
{
  "Key": "attachments/conv-uuid/msg-uuid/requirements.pdf",
  "Id": "storage-uuid"
}
```

**Upload flow:**
1. Frontend creates message (POST /rest/v1/messages) with `content_type: 'file'` or `'image'`
2. Frontend uploads file to Storage at `attachments/{conversation_id}/{message_id}/{filename}`
3. Frontend creates attachment record (POST /rest/v1/attachments) linking message to file
4. File URL in message metadata allows inline preview

**Constraints:**
- Max file size: 10MB
- Allowed types: jpg, png, gif, webp, pdf, txt, md, csv

---

### POST /rest/v1/conversations

**Description:** Create a new group conversation.
**Feature:** FR-13
**Screen:** S-02
**Auth:** Bearer JWT

**Request:**
```json
{
  "type": "group",
  "name": "test-agents",
  "created_by": "auth-user-uuid"
}
```

**Response (201):**
```json
{
  "id": "conv-uuid",
  "type": "group",
  "name": "test-agents",
  "created_by": "auth-user-uuid",
  "created_at": "2026-03-16T10:00:00Z",
  "updated_at": "2026-03-16T10:00:00Z"
}
```

**After creation:** Client must also POST to `/rest/v1/conversation_members` to add the creator (as admin) and selected members.

---

### POST /rest/v1/conversation_members

**Description:** Add members to a group conversation.
**Feature:** FR-13
**Screen:** S-02, S-05
**Auth:** Bearer JWT

**Request (batch):**
```json
[
  { "conversation_id": "conv-uuid", "user_id": "uuid-1", "role": "admin" },
  { "conversation_id": "conv-uuid", "user_id": "uuid-2", "role": "member" },
  { "conversation_id": "conv-uuid", "user_id": "uuid-3", "role": "member" }
]
```

**Response (201):** Array of created records.

**RLS:** Only conversation admins can add members.

---

### DELETE /rest/v1/conversation_members

**Description:** Remove a member (or leave group).
**Feature:** FR-13
**Screen:** S-05
**Auth:** Bearer JWT

**Query params:**
| Param | Value |
|-------|-------|
| `conversation_id` | `eq.{uuid}` |
| `user_id` | `eq.{uuid}` |

**RLS:** User can remove self (leave) or admin can remove anyone.

---

### GET /rest/v1/conversation_members

**Description:** Get members of a conversation.
**Feature:** FR-13
**Screen:** S-04, S-05
**Auth:** Bearer JWT

**Query params:**
| Param | Value |
|-------|-------|
| `conversation_id` | `eq.{uuid}` |
| `select` | `*,user:users(id,display_name,avatar_url,is_agent,last_seen_at)` |

**Response (200):**
```json
[
  {
    "conversation_id": "conv-uuid",
    "user_id": "uuid-1",
    "role": "admin",
    "joined_at": "2026-03-16T10:00:00Z",
    "user": {
      "id": "uuid-1",
      "display_name": "Phuc",
      "avatar_url": null,
      "is_agent": false,
      "last_seen_at": "2026-03-16T10:33:00Z"
    }
  }
]
```

---

### POST /rpc/mark_conversation_read

**Description:** Mark a conversation as read (update last_read_at).
**Feature:** FR-17
**Screen:** S-03, S-04
**Auth:** Bearer JWT

**Request:**
```json
{
  "conv_id": "conv-uuid"
}
```

**Response (200):** `null` (void function)

---

### POST /rest/v1/reactions (Phase 3)

**Description:** Add an emoji reaction to a message.
**Feature:** FR-18
**Screen:** S-03, S-04
**Auth:** Bearer JWT

**Request:**
```json
{
  "message_id": "msg-uuid",
  "user_id": "auth-user-uuid",
  "emoji": "👍"
}
```

**Response (201):**
```json
{
  "id": "reaction-uuid",
  "message_id": "msg-uuid",
  "user_id": "auth-user-uuid",
  "emoji": "👍",
  "created_at": "2026-03-16T10:34:00Z"
}
```

**Conflict:** 409 if duplicate (user already reacted with same emoji).

---

### DELETE /rest/v1/reactions?id=eq.{id} (Phase 3)

**Description:** Remove own reaction.
**Feature:** FR-18
**Auth:** Bearer JWT
**RLS:** Only reaction owner can delete.

---

### GET /rest/v1/users_public (Phase 4 — Admin Only)

**Description:** List all users (admin view). Non-admin users see only non-mock users.
**Feature:** FR-19, FR-21
**Screen:** S-06 (admin), S-02 (sidebar)
**Auth:** Bearer JWT

**Query params:**
| Param | Value | Purpose |
|-------|-------|---------|
| `select` | `*` | All columns except `token` (view enforces) |
| `order` | `created_at.desc` | Newest first |

**Response (200):**
```json
[
  {
    "id": "uuid-1",
    "email": "phuc@example.com",
    "display_name": "Phuc",
    "avatar_url": "https://...",
    "role": "admin",
    "is_mock": false,
    "is_active": true,
    "last_seen_at": "2026-03-16T10:30:00Z",
    "created_at": "2026-03-16T00:00:00Z"
  },
  {
    "id": "uuid-2",
    "email": "test@example.com",
    "display_name": "Test User",
    "avatar_url": "https://...",
    "role": "user",
    "is_mock": true,
    "is_active": true,
    "last_seen_at": null,
    "created_at": "2026-03-16T10:00:00Z"
  }
]
```

**Note:** `users_public` view omits `token` column. Query via view instead of table for security.

---

### POST /rest/v1/users (Phase 4 — Admin Token Generation)

**Description:** Admin generates invite token. System auto-generates placeholder email and default name.
**Feature:** FR-19
**Screen:** S-06
**Auth:** Bearer JWT (admin only)

**Request (Admin generates token):**
```json
{
  "email": "invite-{shortId}@placeholder.local",
  "display_name": "New User",
  "token": "{64-char-random-string}",
  "role": "user",
  "is_agent": false,
  "is_active": true
}
```

**Response (201):** New user record with token. User customizes email/name on first login via /setup.

**Note:** Token is 64-character string with full charset (A-Za-z0-9!@#$%^&*()-_=+[]{}|;:<>?) generated via crypto.getRandomValues. Email/name are auto-generated and replaced by user on /setup.

---

### PATCH /rest/v1/users?id=eq.{id} (Phase 4 — Admin)

**Description:** Update user (admin can manage roles/status, user can update own profile).
**Feature:** FR-19, FR-20
**Screen:** S-06 (admin), S-07 (setup)
**Auth:** Bearer JWT

**Request (Admin updating status):**
```json
{
  "is_active": false,
  "is_mock": true
}
```

**Request (User updating own profile):**
```json
{
  "display_name": "Alice Updated",
  "avatar_url": "https://api.dicebear.com/9.x/adventurers/svg?seed=alice"
}
```

**Response (200):** Updated user record.

**RLS:** Users can only update own record; admins can update any record.

---

### DELETE /rest/v1/users?id=eq.{id} (Phase 4 — Admin Only)

**Description:** Delete a user account.
**Feature:** FR-19
**Screen:** S-06
**Auth:** Bearer JWT (admin only)

**RLS:** Only admins can delete users.

**Cascade:** Deleting user removes all conversation_members, messages stay (orphaned, re-assigned to system user if needed).

---

### POST /rpc/update_profile (Phase 4)

**Description:** Users complete setup wizard (avatar selection + nickname).
**Feature:** FR-20
**Screen:** S-07
**Auth:** Bearer JWT

**Request:**
```json
{
  "display_name": "Alice",
  "avatar_url": "https://api.dicebear.com/9.x/adventurers/svg?seed=alice"
}
```

**Response (200):** Updated user object.

---

## 3. Realtime Subscriptions

### Message delivery (FR-08)

```typescript
supabase
  .channel(`messages:${conversationId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}`
  }, (payload) => {
    // Append new message to chat UI
  })
  .subscribe()
```

### Online presence (FR-03)

```typescript
const presenceChannel = supabase.channel('online-users')

presenceChannel
  .on('presence', { event: 'sync' }, () => {
    const state = presenceChannel.presenceState()
    // Update online users list
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await presenceChannel.track({
        user_id: currentUser.id,
        display_name: currentUser.display_name,
        is_agent: currentUser.is_agent,
        online_at: new Date().toISOString()
      })
    }
  })
```

### Typing indicators (FR-16 — Phase 3)

```typescript
// Send typing event
supabase.channel(`typing:${conversationId}`)
  .send({
    type: 'broadcast',
    event: 'typing',
    payload: { user_id: currentUser.id, display_name: currentUser.display_name }
  })

// Listen for typing events
supabase.channel(`typing:${conversationId}`)
  .on('broadcast', { event: 'typing' }, (payload) => {
    // Show typing indicator, debounce 3s
  })
  .subscribe()
```

## 4. Agent API Integration (FR-14)

Agents use the same Supabase REST API as the frontend, authenticated with their own JWT.

### Agent auth flow

1. Admin provisions agent user in `users` table with `is_agent = true`
2. Agent exchanges token via `/rpc/login_with_token` → receives JWT
3. Agent uses JWT for all subsequent API calls

### Agent sends a message

```bash
curl -X POST 'https://{ref}.supabase.co/rest/v1/messages' \
  -H 'apikey: {anon_key}' \
  -H 'Authorization: Bearer {agent_jwt}' \
  -H 'Content-Type: application/json' \
  -d '{
    "conversation_id": "conv-uuid",
    "sender_id": "agent-user-uuid",
    "content": "Here is the analysis you requested...",
    "content_type": "text"
  }'
```

### Agent sends a file

1. Upload file to Storage
2. Create message with `content_type: 'file'` or `'image'` and metadata containing the URL

### Agent receives messages (polling or realtime)

**Option A — Polling:**
```bash
curl 'https://{ref}.supabase.co/rest/v1/messages?conversation_id=eq.{id}&created_at=gt.{last_seen}&order=created_at.asc' \
  -H 'apikey: {anon_key}' \
  -H 'Authorization: Bearer {agent_jwt}'
```

**Option B — Realtime (WebSocket):**
Agent uses Supabase JS/Python client to subscribe to `postgres_changes` on messages table.

## 5. Traceability

| Endpoint | FR | Screen | Phase |
|----------|-------|--------|-------|
| `/rpc/login_with_token` | FR-01, FR-02 | S-01 | P1 |
| `/auth/v1/logout` | FR-02 | S-02 | P1 |
| `/rest/v1/users` | FR-03, FR-09 | S-02 | P1 |
| `/rpc/get_my_conversations` | FR-04 | S-02 | P1 |
| `/rpc/get_unread_counts` | FR-04 | S-02 | P1 |
| `/rpc/find_or_create_dm` | FR-05 | S-02, S-03 | P1 |
| `GET /rest/v1/messages` | FR-06, FR-07 | S-03, S-04 | P1 |
| `POST /rest/v1/messages` | FR-06, FR-08, FR-14 | S-03, S-04 | P1 |
| `/rpc/mark_conversation_read` | FR-17 | S-03, S-04 | P1 |
| `/storage/v1/object/attachments` | FR-10 | S-03, S-04 | P2 |
| `/rest/v1/attachments` | FR-10, FR-11 | S-03, S-05 | P2 |
| `POST /rest/v1/conversations` | FR-13 | S-02 | P2 |
| `/rest/v1/conversation_members` | FR-13 | S-02, S-04, S-05 | P2 |
| `/rest/v1/reactions` | FR-18 | S-03, S-04 | P3 |
| `/rest/v1/users_public` | FR-19, FR-21 | S-06, S-02 | P4 |
| `PATCH /rest/v1/users` | FR-19, FR-20 | S-06, S-07 | P4 |
| `DELETE /rest/v1/users` | FR-19 | S-06 | P4 |
| `/rpc/update_profile` | FR-20 | S-07 | P4 |
| Realtime: messages | FR-08 | S-03, S-04 | P1 |
| Realtime: presence | FR-03 | S-02 | P1 |
| Realtime: typing | FR-16 | S-03, S-04 | P3 |

---

## Next Step

→ Run `/plan @docs/ @prototypes/` to generate implementation tasks
