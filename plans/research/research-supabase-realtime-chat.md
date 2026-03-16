# Supabase Real-Time Chat Application Research Report

**Date:** 2026-03-16
**Research Focus:** Comprehensive evaluation of Supabase for building production-ready real-time chat applications

---

## Executive Summary

Supabase provides a complete, production-ready stack for real-time chat applications through its integrated Realtime service, PostgreSQL database, authentication, Storage, and Edge Functions. The platform handles presence tracking, broadcast messaging, and database synchronization natively, with built-in RLS for security and edge deployment for low latency. This report synthesizes findings across nine research dimensions.

---

## 1. Supabase Realtime: Core Capabilities

### Three Core Features

Supabase Realtime operates on three complementary pillars:

#### 1.1 Broadcast
- **Purpose:** Send low-latency ephemeral messages between clients
- **Characteristics:**
  - Not persisted to database unless explicitly handled
  - Ideal for real-time messaging, notifications, cursor tracking
  - Payload size: 256 KB (Free), 3,000 KB (Pro+)
  - Scoped to specific channels (room names)

**Best Use:** Instant message delivery, typing indicators, presence updates

#### 1.2 Presence
- **Purpose:** Track and synchronize shared state (who's online, active participants)
- **Architecture:**
  - Built on conflict-free replicated data types (CRDT)
  - Automatic state sync across all connected clients
  - Event types: `sync`, `join`, `leave`
  - Supports custom state objects (e.g., `{ user_id: '123', typing: true }`)

**Best Use:** Online indicators, active participants display, collaborative state

#### 1.3 Postgres Changes
- **Purpose:** Listen to real-time database changes (INSERT, UPDATE, DELETE, *)
- **Mechanism:**
  - Subscriptions respect Row Level Security (RLS) policies
  - Filtered at database layer before transmission
  - Only authorized rows sent to clients

**Best Use:** Message history sync, persistent data synchronization

### Architecture & Performance

- **Distributed globally** at the edge for low-latency access
- **WebSocket-based** communication with JWT authentication
- **Multi-tenant** design with automatic tenant isolation
- **Rate Limiting per plan:**
  - Free: 200 connections, 100 messages/sec
  - Pro: 500 connections, 500 messages/sec
  - Pro+ & Team: 10,000 connections, 2,500 messages/sec
  - Enterprise: Configurable

**Critical Limitation:** No guaranteed delivery. Not suitable for critical transactional messaging; applications must handle persistence themselves.

---

## 2. Building Chat/Messaging: Best Patterns

### 2.1 Message Architecture

**Standard Messages Table:**
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id),
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Realtime replication
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

**For Direct Messaging:**
```sql
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES auth.users(id),
  user2_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id),
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**For Group Chats:**
```sql
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(channel_id, user_id)
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id),
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2.2 Implementation Strategy: Dual-Layer Pattern

**Production-ready chat combines two Supabase features:**

1. **Broadcast Layer (Real-time UI Updates)**
   - Messages sent immediately via Broadcast to connected clients
   - No latency for visible participants
   - Does not guarantee delivery

2. **Postgres Changes Layer (Persistence & History)**
   - Messages persisted to database
   - Realtime subscriptions listen to INSERT events
   - Shows message history on reconnection
   - Other clients receive updates via RLS-filtered subscriptions

**Flow:**
```
Client sends message
  ↓
Backend saves to database (Postgres)
  ↓
Trigger fires / Edge Function executes
  ↓
Broadcast to room via Realtime Broadcast
  ↓
All connected clients receive message instantly
  ↓
Postgres Changes notifies other subscribed clients
  ↓
Newly connected clients fetch message history
```

### 2.3 Message Retention & Cleanup

- **Pattern:** Schedule Supabase Edge Function to delete old messages
- **Implementation:** Use pg_cron or external scheduled task
- **Recommendation:** Retain messages based on business requirements
  - Standard: 30-90 days
  - Archive older messages to separate table if audit trail needed

### 2.4 Channel Management

**Private Channels:** Require Realtime Authorization
- Assign JWT claims to users
- Validate claims in policies before allowing subscription
- Control both read and write access per user role

**Public Channels:** No authorization needed but still use RLS for database operations

---

## 3. Supabase Auth: Token-Based Authentication & User Management

### 3.1 Token Architecture

**JWT-Based System:**
- Supabase Auth uses JSON Web Tokens for authentication
- Default algorithm: RS256 (asymmetric, recommended)
- Alternative: HS256/HS384/HS512 (symmetric, for legacy systems)
- All tokens include mandatory `exp` and `role` claims

**Token Lifecycle:**
```
Access Token (short-lived)
├─ Expiry: Configurable (default 1 hour)
├─ Used for: API requests, database access
└─ Automatic refresh: SDK handles transparently

Refresh Token (long-lived)
├─ Expiry: Never (single-use)
├─ Used for: Obtaining new access tokens
└─ Revocation: Possible via auth.signOut()
```

### 3.2 User Management & Admin Controls

**Built-in Provider Support:**
- Email + Password
- Magic Links (passwordless)
- One-Time Passwords (OTP via email/SMS)
- Social Login (Google, GitHub, Discord, etc.)
- Single Sign-On (SSO/SAML)

**Admin API (Service Role):**
- Requires `service_role` JWT (backend only, never expose to client)
- Create users: `supabase.auth.admin.createUser()`
- Update user metadata: Admin can set `raw_app_meta_data` and `raw_user_meta_data`
- Disable/delete users
- Reset passwords on behalf of users

**Client SDK:**
- Auto-sends user's Auth Token with every request
- SDK automatically refreshes expired tokens
- Session stored locally (localStorage/AsyncStorage for mobile)

### 3.3 Token Security Best Practices

- **Never expose service_role in browser**
- **Asymmetric keys (RS256+) recommended** over HS256
- **Custom Access Token Hook:** Modify token claims before issuance
  - Add user roles from database
  - Embed team/org IDs for RLS filtering
  - Trigger: Before token is issued

**Example Custom Hook (pseudo-code):**
```typescript
// Adds role from database before token issued
SELECT role FROM user_roles WHERE user_id = auth.uid()
// Token now includes 'role' claim → RLS policies can reference
```

---

## 4. Online Presence, DMs, & Group Messaging

### 4.1 Online Presence Detection

**Implementation using Presence feature:**
```typescript
// Subscribe to presence changes
const subscription = supabase.channel('online-status')
  .on('presence', { event: 'sync' }, payload => {
    // payload contains all online users in channel
  })
  .on('presence', { event: 'join' }, ({ newPresences }) => {
    // New user came online
  })
  .on('presence', { event: 'leave' }, ({ leftPresences }) => {
    // User went offline
  })
  .subscribe();

// Track current user's presence
channel.track({
  user_id: userId,
  username: userName,
  status: 'online'
});
```

**State Object Example:**
```json
{
  "user_id": "uuid-123",
  "username": "alice",
  "typing": false,
  "last_activity": "2026-03-16T10:30:00Z"
}
```

### 4.2 Direct Messaging (1-to-1)

**Flow Architecture:**
1. Create/retrieve chat record linking two users
2. Subscribe to messages in that chat via Postgres Changes
3. Subscribe to Broadcast channel for that chat ID
4. Send message → Save to DB → Broadcast to room

**RLS Policy for DM Access:**
```sql
CREATE POLICY "Users can only see their own DMs"
  ON messages
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user1_id FROM chats WHERE id = messages.chat_id
      UNION
      SELECT user2_id FROM chats WHERE id = messages.chat_id
    )
  );
```

**DM Presence (Optional):**
- Subscribe to DM recipient's presence channel
- Show "typing", "online", "last seen" indicators
- Debounce typing updates (send every 3 seconds max)

### 4.3 Group Messaging

**Flow Architecture:**
1. User joins group/channel
2. Subscribe to Broadcast channel: `group-{group_id}`
3. Subscribe to Postgres Changes on messages WHERE channel_id = group_id
4. Presence tracks active members in the channel

**RLS Policy for Group Messages:**
```sql
CREATE POLICY "Members can see group messages"
  ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = messages.channel_id
      AND channel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Only members can send"
  ON messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = messages.channel_id
      AND channel_members.user_id = auth.uid()
    )
  );
```

### 4.4 Typing Indicators

**Pattern:**
```typescript
// Debounce: Send typing status every 3 seconds, hide after 5 seconds
const typingChannel = supabase.channel(`typing-${chatId}`)
  .on('broadcast', { event: 'user-typing' }, payload => {
    // Show "X is typing..." indicator
  });

// User starts typing
let typingTimeout;
input.addEventListener('input', () => {
  clearTimeout(typingTimeout);
  typingChannel.send({
    type: 'broadcast',
    event: 'user-typing',
    payload: { user_id: userId }
  });
  typingTimeout = setTimeout(() => {
    typingChannel.send({
      type: 'broadcast',
      event: 'user-stopped-typing',
      payload: { user_id: userId }
    });
  }, 5000);
});
```

---

## 5. File Storage & Media Capabilities

### 5.1 Core Storage Features

**Upload Methods:**
- Standard Upload: Files ≤ 6 MB (simple, multipart/form-data)
- TUS Resumable Upload: Files > 6 MB (reliable, resumable on network failure)
- S3 Compatible API: For advanced use cases

**File Size Limits:**
- Per upload: 5 GB max
- Per bucket: Unlimited (subject to project storage quota)

**Storage Types:**
1. **Files Buckets** - Media (images, videos, PDFs, documents)
2. **Analytics Buckets** - Apache Iceberg format for big data
3. **Vector Buckets** - Optimized for embeddings/AI search

### 5.2 Media Processing

**Built-in Image Optimization:**
- On-the-fly resizing
- Format conversion (auto WebP for modern browsers)
- Compression
- No pre-processing needed

**Example:**
```typescript
// Original image
https://bucket.supabase.co/object/public/files/photo.jpg

// Optimized: 300x300, WebP format
https://bucket.supabase.co/object/public/files/photo.jpg?width=300&height=300&format=webp
```

### 5.3 Integrating Storage with Chat

**Pattern: Store file metadata in database**
```sql
CREATE TABLE message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id),
  file_path TEXT NOT NULL, -- supabase storage path
  file_type TEXT, -- image/pdf/etc
  file_size INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Chat Message with File:**
1. User selects file
2. Upload to Supabase Storage
3. Get public URL or signed URL
4. Create message record with attachment metadata
5. Broadcast message with file URL

**Security: Signed URLs**
- Use for private files
- Expire after specified duration (default 60 seconds)
- Example use: Encrypted documents, private photos

### 5.4 Global CDN & Performance

- **285+ cities worldwide** with edge caching
- **Cache invalidation:** Changes propagate globally in ~60 seconds
- **Cost:** Included in storage quota, outbound bandwidth charges apply

---

## 6. Row Level Security (RLS) for Chat Applications

### 6.1 Core RLS Mechanics

**How RLS Works:**
- Adds `WHERE` clause to every database query
- Enforced at PostgreSQL layer (not bypassed by malicious clients)
- Integrates with Supabase Auth: `auth.uid()` returns current user ID

**Four Policy Types:**
- `SELECT`: Which rows user can read (using clause)
- `INSERT`: Which rows user can add (with check clause)
- `UPDATE`: Which rows user can modify (using + with check)
- `DELETE`: Which rows user can remove (using clause)

### 6.2 Chat-Specific RLS Patterns

**Pattern 1: User-Scoped Messages (1-to-1 DM)**
```sql
-- Users see messages only in their DMs
CREATE POLICY "User can see their DM messages"
  ON messages
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND auth.uid() IN (
      SELECT user1_id FROM chats WHERE id = messages.chat_id
      UNION
      SELECT user2_id FROM chats WHERE id = messages.chat_id
    )
  );

-- Only sender or recipient can send
CREATE POLICY "User can send DM"
  ON messages
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() IN (
      SELECT user1_id FROM chats WHERE id = chat_id
      UNION
      SELECT user2_id FROM chats WHERE id = chat_id
    )
    AND sender_id = auth.uid()
  );
```

**Pattern 2: Channel/Group Messages**
```sql
-- Only channel members see messages
CREATE POLICY "Members see channel messages"
  ON messages
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = messages.channel_id
      AND channel_members.user_id = auth.uid()
    )
  );

-- Only members can send (and sender_id must match auth.uid())
CREATE POLICY "Members can send to channel"
  ON messages
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = messages.channel_id
      AND channel_members.user_id = auth.uid()
    )
  );
```

**Pattern 3: Role-Based Access (Admin/Moderator)**
```sql
-- Admins see all messages in their org
-- Using custom JWT claim 'org_id' and 'role'
CREATE POLICY "Admins see org messages"
  ON messages
  FOR SELECT
  USING (
    auth.jwt() ->> 'role' = 'admin'
    AND messages.org_id = (auth.jwt() ->> 'org_id')::uuid
  );
```

### 6.3 RLS + Realtime Integration

**Critical:** Realtime subscriptions respect RLS policies
- User can only subscribe to rows they have SELECT access to
- Postgres Changes filters at database layer
- Broadcast channels are separate (no built-in RLS, but can validate manually)

**Best Practice for Private Channels:**
```typescript
// Server validates membership before allowing broadcast subscription
const supabase = createClient(url, serviceRoleKey); // Backend

export async function validateChannelAccess(userId, channelId) {
  const { data, error } = await supabase
    .from('channel_members')
    .select('1')
    .eq('user_id', userId)
    .eq('channel_id', channelId)
    .single();

  return !error; // True if user is member
}
```

### 6.4 Performance Considerations

**Optimization Rules:**
1. **Index on user_id columns:** Queries with `auth.uid()` benefit from indexes
   ```sql
   CREATE INDEX idx_messages_chat_id ON messages(chat_id);
   CREATE INDEX idx_channel_members_user_channel ON channel_members(user_id, channel_id);
   ```

2. **Avoid N+1 subqueries in policies:**
   - Prefer JOINs over EXISTS when possible
   - Use function with STABLE designation if repeating logic

3. **Explicit filtering > RLS alone:**
   - Client should send `WHERE user_id = auth.uid()` in query
   - RLS acts as safety net, not primary filter

4. **JWT claims for tenant IDs:**
   - Store `org_id` in token custom claims
   - RLS policies reference token, not database query
   - Reduces filtering overhead for multi-tenant apps

---

## 7. Supabase Edge Functions for Agent Integration

### 7.1 Core Capabilities

**Edge Functions are:**
- Server-side TypeScript functions (Deno-compatible)
- Deployed globally at the edge (low latency)
- Automatically scaled, pay-per-invocation

**Execution Environment:**
- Runtime: Deno (WASM-based, fast startup)
- Region: Deployed globally, executes near user
- Latency: Typically 10-100ms from request to response
- Cold starts: ~100-200ms on first invocation

### 7.2 Agent Workflows with Edge Functions

**Common Patterns:**

#### Pattern A: Message Processing Agent
```typescript
// Triggered by: Webhook on message INSERT
// Function: Process, analyze, or respond to messages

export default async (req, context) => {
  const message = await req.json();

  // Analyze sentiment
  const sentiment = await analyzeSentiment(message.content);

  // Update message with analysis
  const supabase = createClient();
  await supabase
    .from('messages')
    .update({ sentiment_score: sentiment })
    .eq('id', message.id);

  // Notify if flagged
  if (sentiment < -0.7) {
    await supabase.from('notifications').insert({
      user_id: message.chat_id_owner,
      message: 'Negative message detected'
    });
  }
};
```

#### Pattern B: AI Response Agent
```typescript
// Triggered by: User sends message to bot
// Function: Generate and store AI response

export default async (req, context) => {
  const { chat_id, user_message } = await req.json();

  // Call external AI API
  const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${Deno.env.get('OPENAI_KEY')}` },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'user', content: user_message }]
    })
  });

  const { choices } = await aiResponse.json();
  const botMessage = choices[0].message.content;

  // Store bot response in messages table
  const supabase = createClient();
  const { data } = await supabase
    .from('messages')
    .insert({
      chat_id,
      sender_id: botUserId,
      content: botMessage
    })
    .select();

  return new Response(JSON.stringify(data), { status: 200 });
};
```

#### Pattern C: Rate Limiting Agent
```typescript
// Triggered by: Before message is saved
// Function: Check if user exceeded message quota

export default async (req, context) => {
  const { user_id, timestamp } = await req.json();
  const supabase = createClient();

  // Check messages in last 60 seconds
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact' })
    .eq('sender_id', user_id)
    .gt('created_at', new Date(timestamp - 60000).toISOString());

  if (count >= 10) {
    return new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 });
  }

  return new Response(JSON.stringify({ allowed: true }), { status: 200 });
};
```

### 7.3 Webhook Integration

**Setup Webhooks from chat events:**
```typescript
// Database webhook on messages.INSERT
// Triggers Edge Function: https://project.supabase.co/functions/v1/process-message

const webhookPayload = {
  type: 'INSERT',
  table: 'messages',
  record: {
    id: 'uuid',
    chat_id: 'uuid',
    sender_id: 'uuid',
    content: 'Hello',
    created_at: '2026-03-16T...'
  },
  schema: 'public',
  old_record: null
};
```

**In Edge Function:**
```typescript
// Receive webhook payload
const { type, table, record } = await req.json();

if (table === 'messages' && type === 'INSERT') {
  // Process new message
  await processNewMessage(record);
}
```

### 7.4 Rate Limiting on Edge Functions

**March 2026 Update:** Rate limit on recursive/nested Edge Function calls
- Applies to: Function A calling Function B
- Threshold: Configurable per project
- Impact: Important for chained agent workflows

**Mitigation:**
- Use direct Postgres calls instead of nested function calls
- Implement caching for frequently accessed data
- Contact support for custom limits on Enterprise

---

## 8. Rate Limiting & Scaling Considerations

### 8.1 Plan-Based Limits

| Metric | Free | Pro | Pro+ & Team | Enterprise |
|--------|------|-----|-------------|-----------|
| Realtime Connections | 200 | 500 | 10,000 | Configurable |
| Messages/sec | 100 | 500 | 2,500 | Configurable |
| Channels per connection | 100 (all plans) | 100 | 100 | 100 |
| Broadcast payload | 256 KB | 256 KB | 3,000 KB | 3,000 KB |
| Presence keys/object | 10 (all plans) | 10 | 10 | 10 |

**All limits are configurable per project upon request.**

### 8.2 Scaling Architecture for Production Chat

#### Tier 1: Small Scale (≤1,000 concurrent users)
- Single Supabase Free or Pro project
- Direct Postgres connections
- Standard RLS policies
- Edge Functions for basic automation

#### Tier 2: Medium Scale (1,000 - 10,000 concurrent users)
- Pro or Team plan
- Connection pooling (PgBouncer) for Edge Functions
- Optimized RLS policies (indexes, JWT claims in token)
- Custom rate limit increases

#### Tier 3: Large Scale (10,000+ concurrent users)
- Team or Enterprise plan
- Dedicated Realtime cluster
- Sharded database architecture (multiple tables per shard)
- Custom rate limiting per user
- Message batching & compression

### 8.3 Handling Rate Limits

**When limit exceeded:**
- WebSocket disconnect with error: `too_many_connections`, `too_many_messages`
- supabase-js SDK auto-reconnects when throughput decreases
- Application should implement exponential backoff

**Prevention Strategies:**
1. **Per-user rate limiting:**
   ```sql
   CREATE FUNCTION check_message_rate_limit(user_id UUID) RETURNS BOOLEAN AS $$
     SELECT COUNT(*) < 10 FROM messages
     WHERE sender_id = user_id
     AND created_at > NOW() - INTERVAL '1 minute';
   $$ LANGUAGE SQL STABLE;
   ```

2. **Message batching:**
   - Client batches messages if sending >10/sec
   - Send batch every 100ms or when batch reaches 50 items

3. **Connection pooling:**
   - Use for serverless functions (Edge Functions, Lambda)
   - PgBouncer or pgcat configuration

4. **Custom claims in JWT:**
   - Store user tier/quota in token
   - Reduce database queries in RLS policies

### 8.4 Monitoring & Alerts

**Metrics to track:**
- Active realtime connections
- Messages per second
- Average message latency
- Edge Function invocations & duration
- Database query latency

**Tools:**
- Prometheus metrics at `/metrics` endpoint
- Supabase dashboard usage page
- Custom Edge Functions for metrics collection

---

## 9. Chat App Templates & Open-Source Examples

### 9.1 Official Supabase Resources

**Realtime Chat Component:**
- Location: `https://supabase.com/ui/docs/nextjs/realtime-chat`
- Framework: Next.js
- Features: Message persistence, real-time sync, auto-scroll
- Size: ~100 lines of code
- License: MIT (part of Supabase UI)

**Components Included:**
- `chat-message.tsx` - Individual message rendering
- `realtime-chat.tsx` - Chat container with full flow
- `use-realtime-chat.tsx` - Custom hook for broadcast logic
- `use-chat-scroll.tsx` - Auto-scroll-to-bottom logic

### 9.2 Community Templates

#### Flutter Chat (supabase-community/flutter-chat)
- **URL:** https://github.com/supabase-community/flutter-chat
- **Platform:** Flutter (iOS, Android, Web)
- **Features:** Realtime messaging, RLS with auth branch
- **Status:** Active, well-maintained
- **Example:** 1-to-1 chat with row-level security examples

#### Vercel AI Chatbot (supabase-community/vercel-ai-chatbot)
- **URL:** https://github.com/supabase-community/vercel-ai-chatbot
- **Stack:** Next.js, Vercel AI SDK, OpenAI, Supabase
- **Features:** AI-powered chat, streaming responses, auth
- **Status:** Maintained, production-ready
- **Use case:** Bot integration patterns

#### Vue 3 Chat (afsakar/supabase-chat)
- **URL:** https://github.com/afsakar/supabase-chat
- **Framework:** Vue 3
- **Features:** Simple implementation, good for learning
- **Status:** Open source example

#### SwiftUI Chat
- **Reference:** Medium article by Ardyan
- **Platform:** iOS (SwiftUI)
- **Size:** <100 lines complete chat app
- **Status:** Proof of concept

### 9.3 Course/Tutorial Resources

**egghead.io Courses:**
1. "Build a Real-Time Data Syncing Chat App with Next.js & Supabase"
   - Comprehensive, step-by-step
   - Covers persistence + realtime combined

2. "Build a Realtime Chat App with Remix & Supabase"
   - Remix framework specific
   - Full-stack patterns

**Other Resources:**
- LogRocket: "Remix and Supabase: Build a real-time chat app"
- SitePen: "Building a Serverless Chat Application with Supabase"
- FreeCodeCamp: "How to Build a Realtime Chat App with Angular 20 and Supabase"

### 9.4 Key Patterns from Examples

**Pattern 1: Message Persistence & Real-Time Sync**
```typescript
// 1. Subscribe to realtime changes
const subscription = supabase
  .from('messages')
  .on('*', payload => {
    setMessages(prev => [...prev, payload.new]);
  })
  .subscribe();

// 2. Also listen to broadcast for instant local updates
const channel = supabase.channel(`chat-${roomId}`);
channel.on('broadcast', { event: 'new-message' }, payload => {
  setMessages(prev => [...prev, payload.message]);
});

// 3. Load historical messages on mount
useEffect(() => {
  supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .then(({ data }) => setMessages(data));
}, [chatId]);
```

**Pattern 2: Sending Messages**
```typescript
const sendMessage = async (content) => {
  // Save to database first (persistence)
  const { data: savedMessage } = await supabase
    .from('messages')
    .insert([{ chat_id: chatId, sender_id: userId, content }])
    .select()
    .single();

  // Broadcast to room (instant UI update)
  channel.send({
    type: 'broadcast',
    event: 'new-message',
    payload: { message: savedMessage }
  });
};
```

**Pattern 3: Presence & Typing Indicator**
```typescript
// Track user presence
const presence = channel.on('presence', { event: 'sync' }, () => {
  const users = channel.presenceState();
  setActiveUsers(Object.values(users).flat());
}).subscribe();

// Broadcast typing status
const handleInput = () => {
  channel.send({
    type: 'broadcast',
    event: 'typing',
    payload: { user_id: userId, typing: true }
  });
};
```

---

## Key Findings & Recommendations

### Strengths

1. **Complete Stack:** Database, Auth, Realtime, Storage, Functions all integrated
2. **Real-Time Performance:** Broadcast messages arrive instantly (<100ms typical)
3. **Security:** RLS enforced at database layer, not bypassable
4. **Scalability:** Handles 10,000+ concurrent connections per cluster
5. **Global CDN:** Storage served from 285 cities worldwide
6. **Developer Experience:** Simple SDKs, comprehensive documentation, active community

### Limitations & Workarounds

1. **No guaranteed message delivery**
   - Workaround: Always persist to database, Broadcast is UI optimization layer

2. **Realtime connection limits per plan**
   - Workaround: Upgrade plan, batch connections, use connection pooling

3. **Realtime payload size limits**
   - Workaround: Use payload compression, store large files in Storage with reference

4. **No built-in message queue/ordering guarantee**
   - Workaround: Use `created_at` timestamp + ID for ordering, process on client

5. **Rate limiting applies across entire project**
   - Workaround: Implement per-user rate limiting via Edge Function or RLS

### Best Practices Summary

1. **Always use RLS policies** - Never rely on frontend-only authorization
2. **Combine Broadcast + Postgres Changes** - Instant UI + persistent history
3. **Store user roles/orgs in JWT claims** - Reduces RLS policy complexity
4. **Implement debounced typing indicators** - Max 1 broadcast per 3-5 seconds
5. **Use signed URLs for private files** - For sensitive attachments
6. **Index foreign key columns** - Essential for RLS policy performance
7. **Test RLS policies thoroughly** - Security vulnerabilities are easy to miss
8. **Monitor Realtime connection usage** - Plan upgrades proactively

---

## Unresolved Questions

1. **Message ordering at scale:** How does Supabase handle message ordering guarantees if network reordering occurs? Current docs recommend sorting by created_at + id client-side, but specific conflict resolution strategy not fully documented.

2. **Edge Function memory limits:** Not clearly specified in docs. What's the max memory available for processing large messages or calling external LLM APIs?

3. **Broadcast encryption:** Can messages be encrypted end-to-end in Broadcast? Docs don't mention built-in E2EE.

4. **Realtime cluster failover:** How are messages handled if a Realtime cluster fails during transmission? Recovery mechanism not detailed.

5. **Custom Realtime rate limiting logic:** How to implement fair-share rate limiting when multiple users share a project? No built-in mechanism found.

6. **Message search/indexing:** No built-in full-text search over messages. Recommend PostgreSQL FTS, but performance at scale (millions of messages) not documented.

---

## Sources

- [Supabase Realtime - Postgres changes](https://supabase.com/features/realtime-postgres-changes)
- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [Supabase Realtime - Presence](https://supabase.com/features/realtime-presence)
- [Supabase Realtime - Broadcast](https://supabase.com/features/realtime-broadcast)
- [Realtime Chat Example](https://supabase.com/ui/docs/nextjs/realtime-chat)
- [Medium: Chat Message Retention in Supabase](https://medium.com/@eduardofelipi/a-practical-guide-to-chat-message-retention-in-supabase-244aebf60767)
- [Supabase MVP Architecture in 2026](https://www.valtorian.com/blog/supabase-mvp-architecture)
- [Auth Documentation](https://supabase.com/docs/guides/auth)
- [Auth Admin API](https://supabase.com/docs/reference/javascript/admin-api)
- [Row Level Security Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [RLS Best Practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [Storage Documentation](https://supabase.com/docs/guides/storage)
- [Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [Edge Functions with AI Models](https://supabase.com/docs/guides/functions/ai-models)
- [Rate Limiting Limits](https://supabase.com/docs/guides/realtime/limits)
- [Realtime Benchmarks](https://supabase.com/docs/guides/realtime/benchmarks)
- [GitHub: supabase/realtime](https://github.com/supabase/realtime)
- [supabase-community/flutter-chat](https://github.com/supabase-community/flutter-chat)
- [supabase-community/vercel-ai-chatbot](https://github.com/supabase-community/vercel-ai-chatbot)
- [LogRocket: Remix and Supabase Chat](https://blog.logrocket.com/remix-supabase-real-time-chat-app/)
- [SitePen: Serverless Chat with Supabase](https://www.sitepen.com/blog/building-a-serverless-chat-application-with-supabase)

