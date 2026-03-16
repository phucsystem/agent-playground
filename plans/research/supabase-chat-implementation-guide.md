# Supabase Chat Implementation Guide

**For decision-makers and architects planning Supabase-based chat systems**

---

## Phase 1: Design Decisions

### 1.1 Message Storage Strategy

**Decision Tree:**

```
Are messages permanent?
├─ NO (ephemeral, e.g., gaming chat)
│  └─ Use Broadcast only (fast, simple)
│     Cost: Messages lost if client disconnects
│     Use case: Real-time notifications, game events
│
└─ YES (persistent, e.g., DM, group chat)
   └─ Use Dual-Layer (Broadcast + Postgres Changes)
      Cost: Slightly higher latency (async persistence)
      Benefit: History available, RLS controlled
      USE THIS for most chat apps
```

**Recommendation:** Always persist messages. Broadcast latency improvement (<50ms) rarely worth losing history.

---

### 1.2 Architecture: Direct Messaging vs Groups

**1-to-1 Direct Messages (DMs)**
- Simpler: No membership table needed
- `chats` table links user1 + user2
- `messages` belongs to `chat_id`
- RLS: Check user is in chat
- Best for: Customer support, personal messaging

**Group/Channel Messaging**
- More complex: Need `channel_members` table
- `messages` belongs to `channel_id`
- RLS: Check user in `channel_members`
- Best for: Team collaboration, communities, support channels

**Hybrid (both DMs + groups in same app)**
- Use single `messages` table with nullable `channel_id` and `dm_chat_id`
- OR separate tables (`direct_messages`, `group_messages`)
- Recommendation: Separate tables for clarity

---

### 1.3 Presence & Online Status

**Option A: Real-Time Presence (recommended)**
```typescript
// User status updates in real-time
// Automatic cleanup on disconnect
// Low bandwidth (<1KB per user)
channel.track({ user_id, online: true });
```
- Best for: Chat UIs, collaborative apps
- Cost: Connection per channel
- Limitation: Limited to 10 custom keys per presence object

**Option B: Database Tracking (not recommended)**
```sql
CREATE TABLE user_status (
  user_id UUID PRIMARY KEY,
  last_seen TIMESTAMP,
  status TEXT -- 'online', 'away', 'offline'
);
```
- Cost: Polling overhead, eventual consistency
- Benefit: Persistent history
- Use only if: Tracking last_seen is critical

**Decision:** Use Presence for real-time, periodic `last_seen` updates to DB via Edge Function

---

### 1.4 Typing Indicators

**Requirement:** Show "User is typing..." when user types

**Implementation:**
```
User types
  ↓
Debounce 300ms (don't send on every keystroke)
  ↓
Broadcast 'user-typing' event (max every 3 sec)
  ↓
Show indicator on other clients
  ↓
Auto-hide after 5 seconds of no input
```

**Cost:** Low (small broadcast payload: ~100 bytes per user)
**Key:** Debounce heavily—saves 10-50x bandwidth vs unthrottled

---

### 1.5 File Attachments

**Decision: Use Supabase Storage + Reference**

```
User selects file
  ↓
Upload to Storage (large, not in message)
  ↓
Store file path in message record
  ↓
Get public or signed URL
  ↓
Render as link/preview in chat UI
```

**Why not store in message JSON?**
- Message size limit (Realtime: 256 KB - 3,000 KB)
- Files should be streamed, not broadcast
- CDN serving is separate concern

**For private files:**
- Use signed URLs (expire after 1-3600 seconds)
- RLS controls who can access storage bucket

---

### 1.6 Admin/Bot Messages

**Pattern:**
```sql
-- Create bot user in auth.users
INSERT INTO auth.users (...) VALUES (...bot_user...);

-- Bot uses service_role to send messages
CREATE TABLE message_authors (
  message_id UUID REFERENCES messages(id),
  author_id UUID REFERENCES auth.users(id), -- bot user
  author_type TEXT -- 'user', 'bot', 'system'
);
```

**Use Cases:**
- AI response agent
- System notifications ("X joined chat")
- Broadcast notifications ("Server maintenance in 5 min")

---

## Phase 2: Technical Setup

### 2.1 Project Initialization Checklist

```
[ ] Create Supabase project
[ ] Enable Auth (Email + Password minimum)
[ ] Create auth schema if using custom auth
[ ] Create messages, chats/channels, members tables
[ ] Enable Realtime on message tables (SQL editor > Replication)
[ ] Create RLS policies
[ ] Create indexes on foreign keys
[ ] Create Storage bucket(s) for files
[ ] Set up Edge Functions (if using bots/agents)
[ ] Configure custom JWT claims (if needed)
```

---

### 2.2 Environment Variables

```bash
# .env.local (frontend safe)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...

# .env.local (backend only)
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
SUPABASE_JWT_SECRET=secret...

# .env.local (optional, for Edge Functions)
OPENAI_API_KEY=sk-xxx...
```

---

### 2.3 Schema Migration Order

1. **Auth users** (auto-created by Supabase)
2. **Profiles table** (optional, extends auth.users)
3. **Chats / Channels tables**
4. **Members tables** (for groups)
5. **Messages table**
6. **Enable Realtime** on messages
7. **RLS policies**
8. **Indexes**
9. **Storage buckets**
10. **Edge Functions** (webhooks, agents)

---

### 2.4 RLS Policy Testing

**Critical:** Test RLS before launch

```sql
-- Test as user1 (should see only own messages)
SET SESSION "request.jwt.claims" = '{"sub": "user1-uuid"}'::jsonb;
SELECT * FROM messages; -- Should see only messages user1 sent or received

-- Test as user2 (should see only own messages)
SET SESSION "request.jwt.claims" = '{"sub": "user2-uuid"}'::jsonb;
SELECT * FROM messages; -- Should NOT see user1's private messages

-- Test as anonymous (should see nothing)
SET SESSION "request.jwt.claims" = NULL::jsonb;
SELECT * FROM messages; -- Should return 0 rows
```

---

## Phase 3: Performance & Scaling

### 3.1 Single Project Limits (when to scale)

**Until 5,000 concurrent users:**
- Single Supabase project
- Pro plan ($25/month)
- Direct Postgres connections

**5,000 - 50,000 concurrent users:**
- Team plan ($50/month) or Pro with upgrades
- Connection pooling (PgBouncer) for Edge Functions
- Optimized RLS policies (indexes, JWT claims)
- Database read replicas (optional)

**50,000+ concurrent users:**
- Enterprise plan
- Dedicated infrastructure
- Message sharding by chat_id or channel_id
- Separate read/write clusters

---

### 3.2 RLS Policy Optimization

**Before (slow):**
```sql
-- Triggers subquery on every message read
CREATE POLICY "Users see their messages"
  ON messages
  FOR SELECT
  USING (
    sender_id = auth.uid() OR
    receiver_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_id = messages.channel_id
      AND user_id = auth.uid()
    )
  );
```

**After (fast):**
```sql
-- Use JWT claim instead of subquery
-- JWT claim: { "orgs": ["org-1", "org-2"] }

CREATE POLICY "Users see org messages"
  ON messages
  FOR SELECT
  USING (
    auth.jwt() ->> 'org_id' = messages.org_id
  );
```

**Optimization rules:**
1. Index `user_id` columns
2. Store frequently-checked data in JWT claims
3. Avoid COUNT(*) in policies
4. Avoid function calls unless STABLE

---

### 3.3 Message Throughput Scaling

**Current bottleneck analysis:**

| Component | Limit | Mitigation |
|-----------|-------|-----------|
| Realtime Connections | 200-10K | Upgrade plan |
| Message throughput | 100-2,500 msgs/sec | Batch messages, upgrade |
| Database writes | ~10K writes/sec | Connection pooling, sharding |
| Broadcast payload | 256 KB - 3 MB | Compression, split large files |

**Practical scaling:**
- For 10K concurrent users with average 10 msgs/sec each = 100K msgs/sec
- Supabase limit: 2,500 msgs/sec (Team plan)
- Solution: Message batching, use Edge Function to aggregate/fan-out

---

### 3.4 Database Connection Pooling

**For Edge Functions:**
```typescript
import { createClient } from '@supabase/supabase-js';

// Use connection pooling endpoint (not direct Postgres)
const supabase = createClient(
  'https://project.supabase.co',
  'service_role_key',
  {
    db: {
      schema: 'public'
    }
  }
);
```

**Supabase dashboard:**
- Project Settings > Database > Connection Pooling
- Mode: Transaction (default, works for most cases)
- Min/Max pools: Auto-configured by Supabase

---

## Phase 4: Security Implementation

### 4.1 RLS Policies Checklist

```
[ ] All tables have RLS enabled
[ ] All policies tested (as user A, B, anonymous)
[ ] No SELECT without WHERE (no full table scans)
[ ] Foreign keys verified (can't be manipulated)
[ ] Sender_id = auth.uid() enforced on INSERT
[ ] Timestamps cannot be modified by users
[ ] Storage bucket has access control policies
[ ] JWT secret is strong (>32 chars)
[ ] Custom JWT claims validated server-side
```

---

### 4.2 File Access Control

**Pattern: Public vs Private**

```sql
-- Public bucket (any authenticated user can access)
CREATE POLICY "Anyone can read files"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'public-files');

-- Private bucket (only owner or RLS check)
CREATE POLICY "Users can see shared files"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'private-files'
    AND EXISTS (
      SELECT 1 FROM message_attachments
      WHERE file_path = objects.name
      AND chat_id IN (
        SELECT id FROM chats
        WHERE user1_id = auth.uid() OR user2_id = auth.uid()
      )
    )
  );
```

---

### 4.3 Rate Limiting Implementation

**Database-level (RLS check):**
```sql
CREATE FUNCTION check_message_rate_limit(user_id UUID) RETURNS BOOLEAN AS $$
  SELECT COUNT(*) < 10 FROM messages
  WHERE sender_id = user_id
  AND created_at > NOW() - INTERVAL '1 minute';
$$ LANGUAGE SQL STABLE;

-- Use in INSERT policy
CREATE POLICY "Rate limit messages"
  ON messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND check_message_rate_limit(auth.uid())
  );
```

**Edge Function-level (for custom logic):**
```typescript
// Before saving message
export default async (req, context) => {
  const { user_id, message } = await req.json();

  // Check quota
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact' })
    .eq('sender_id', user_id)
    .gt('created_at', new Date(Date.now() - 60000).toISOString());

  if (count >= 10) {
    return new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
```

---

## Phase 5: Monitoring & Operations

### 5.1 Metrics to Monitor

```typescript
// Custom Edge Function for metrics
export default async (req, context) => {
  const supabase = createClient();

  // Active users
  const { count: activeUsers } = await supabase
    .from('user_status')
    .select('*', { count: 'exact' })
    .eq('status', 'online');

  // Messages per minute (last 60 sec)
  const oneMinAgo = new Date(Date.now() - 60000).toISOString();
  const { count: messagesPerMin } = await supabase
    .from('messages')
    .select('*', { count: 'exact' })
    .gt('created_at', oneMinAgo);

  // Slow queries (>100ms)
  // ... fetch from monitoring system

  return new Response(JSON.stringify({
    activeUsers,
    messagesPerMin,
    timestamp: new Date()
  }), { status: 200 });
};
```

**Dashboard:**
- Supabase Dashboard > Statistics (realtime usage)
- Custom Prometheus scrape on Edge Function metrics endpoint
- PagerDuty alert on connection limit or message throughput warnings

---

### 5.2 Debugging Checklist

**Real-time not working?**
```typescript
// 1. Check RLS allows subscription
SELECT * FROM auth.users WHERE id = current_user_id; -- Should return user

// 2. Check table is in publication
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

// 3. Check browser console for connection errors
console.log(supabase.realtime.state); // Should be 'SUBSCRIBED'
```

**Messages not persisting?**
```sql
-- 1. Check RLS allows INSERT
INSERT INTO messages (...) VALUES (...); -- Should succeed or show clear error

-- 2. Check triggers are firing (if you have any)
SELECT * FROM information_schema.triggers WHERE table_name = 'messages';

-- 3. Check created_at timestamp
SELECT NOW(); -- Current server time
```

**RLS blocking access?**
```sql
-- Simulate user session
SET SESSION "request.jwt.claims" = '{"sub": "user-uuid"}'::jsonb;
SELECT * FROM messages; -- Debug what user can see
```

---

## Phase 6: Migration & Deployment

### 6.1 Data Migration from Other Systems

**If migrating from Firebase, Discord, Slack, etc:**

```typescript
// 1. Export messages from source
const sourceMessages = await getMessagesFromFirebase();

// 2. Transform to Supabase schema
const transformed = sourceMessages.map(msg => ({
  id: uuidv5(msg.id), // Preserve IDs if needed
  chat_id: msg.room_id,
  sender_id: msg.user_id,
  content: msg.text,
  created_at: msg.timestamp,
  migrated: true // Mark for auditing
}));

// 3. Bulk insert
const { error } = await supabase
  .from('messages')
  .insert(transformed);
```

---

### 6.2 Database Backup Strategy

```bash
# Daily snapshot (Supabase auto-backups)
# Access via: Project Settings > Backups

# Manual backup before major changes
pg_dump -h db.xxxxx.supabase.co -U postgres mtxprd > backup.sql

# Scheduled backup to S3
# Use pg_cron + Edge Function to dump and upload
```

---

### 6.3 Deployment Phases

**Phase 1: Beta (1-100 users)**
- Free or Pro plan
- Manual testing
- Real-time monitoring

**Phase 2: Soft Launch (100-1,000 users)**
- Team plan
- Automated tests
- Gradual rollout (10% → 25% → 100%)
- Monitor: latency, error rates, RLS violations

**Phase 3: Production (1,000+ users)**
- Dedicated or Enterprise plan
- On-call monitoring
- Rate limit increases pre-approved
- Message archival strategy active

---

## Phase 7: Cost Estimation

### 7.1 Pricing Calculator

**Assumptions:**
- 1,000 daily active users
- 100 messages per user per day = 100K messages/day
- 50 concurrent users at peak
- Average message size: 500 bytes
- 10% of messages have file attachments

**Monthly costs:**

| Component | Usage | Cost |
|-----------|-------|------|
| Database (read/write) | 100K writes + 200K reads | ~$5 |
| Realtime | 50 concurrent users | Included in Team plan |
| Storage | 1GB files | $0.10 |
| Edge Functions | 10K invocations | $2 |
| Bandwidth | 100GB egress | $12 |
| **Plan Total** | **Team Plan** | **$50** |

**Scaling costs:**
- 10K DAU: Team plan + upgrades = $200-500
- 100K DAU: Enterprise = $1,000-5,000+

---

## Phase 8: Common Pitfalls & Solutions

| Pitfall | Impact | Solution |
|---------|--------|----------|
| No RLS on messages | Security vulnerability | Enable RLS, test thoroughly |
| Realtime not enabled | Messages don't sync | Enable in Replication settings |
| Broadcast only (no DB persist) | Lost messages on disconnect | Always persist to DB |
| No indexes on foreign keys | Slow RLS policies | Add indexes after schema creation |
| Unthrottled typing indicators | 10x bandwidth waste | Debounce to 3-5 sec intervals |
| Private files without signed URLs | Unnecessary CDN costs | Use signed URLs for private files |
| Connection pooling not used in Edge Functions | Connection exhaustion | Enable pooling mode |
| No backup strategy | Data loss risk | Set up pg_cron scheduled backups |
| Unoptimized JWT claims | RLS policy subqueries slow | Embed org_id, role in JWT |
| Message limit not considered | Rate limit surprises | Plan limits early, upgrade proactively |

---

## Checklist: Ready for Production

```
Architecture & Design
[ ] Schema designed (DM vs group messages)
[ ] Realtime strategy chosen (Broadcast + Postgres Changes)
[ ] Presence/typing debounce strategy defined
[ ] File storage plan (public vs signed URLs)
[ ] Authentication flow documented
[ ] Rate limiting strategy chosen

Setup
[ ] Supabase project created
[ ] Tables created and indexed
[ ] RLS policies written and tested
[ ] Storage bucket configured
[ ] Edge Functions deployed (if needed)
[ ] Environment variables set

Security
[ ] RLS tested as 3+ user types
[ ] JWT secrets strong (>32 chars)
[ ] Service role never exposed to client
[ ] File access controls verified
[ ] Rate limiting enforced
[ ] CORS configured correctly

Performance
[ ] Indexes on all foreign keys
[ ] JWT claims optimized (no subquery policies)
[ ] Typing indicators debounced
[ ] Message batching strategy ready
[ ] Monitoring dashboard set up

Operations
[ ] Backup strategy documented
[ ] Monitoring alerts configured
[ ] Debugging runbook created
[ ] Deployment checklist ready
[ ] Cost forecast reviewed
[ ] Support plan (Supabase support level chosen)
```

---

## Decision Matrix: When to Choose Supabase

**✅ Good fit:**
- Real-time chat (WebSocket, low latency)
- Row-level multi-tenant architecture
- User growth 1-100K (before mega-scale)
- Small to mid team (easy to operate)
- Startups (low ops overhead)

**⚠️ Mixed fit:**
- Voice/video (use separate provider: Twilio, Agora)
- 1M+ messages/day (consider sharding)
- Complex compliance (SOC2 available, but limited)

**❌ Poor fit:**
- Massive scale (100M+ daily messages) → Use dedicated message queue (Kafka)
- Offline-first mobile → Use local Postgres (SQLite) + sync
- End-to-end encryption required → Use additional E2EE library
- Guaranteed delivery critical → Use message queue, not Realtime

---

## References

- Full Research Report: `research-supabase-realtime-chat.md`
- Quick Reference: `supabase-chat-quick-reference.md`

