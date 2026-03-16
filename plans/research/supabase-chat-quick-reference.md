# Supabase Real-Time Chat: Quick Reference Guide

---

## 1. Core Architecture Decision

**Best Pattern: Dual-Layer (Broadcast + Postgres Changes)**

```
User sends message
├─ Save to PostgreSQL (persistence)
├─ Trigger → Broadcast to room (instant UI)
├─ Postgres Changes notifies subscribers
└─ New connections load history from DB
```

---

## 2. Database Schema Templates

### Direct Messaging (1-to-1)
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

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

### Group Messaging
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

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

---

## 3. RLS Policies (Copy-Paste Ready)

### DM Access Policy
```sql
-- Users see only their own DMs
CREATE POLICY "Users see their DMs"
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

-- Only sender can send
CREATE POLICY "Users send their DMs"
  ON messages
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND sender_id = auth.uid()
    AND auth.uid() IN (
      SELECT user1_id FROM chats WHERE id = chat_id
      UNION
      SELECT user2_id FROM chats WHERE id = chat_id
    )
  );
```

### Group Message Access Policy
```sql
-- Members see group messages
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

-- Members can send
CREATE POLICY "Members send to channel"
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

---

## 4. Frontend Implementation Flow

### Subscribe to Messages (React)
```typescript
useEffect(() => {
  // 1. Load history
  const loadMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    setMessages(data);
  };

  loadMessages();

  // 2. Subscribe to new messages from DB
  const subscription = supabase
    .from(`messages:chat_id=eq.${chatId}`)
    .on('*', payload => {
      setMessages(prev => [...prev, payload.new]);
    })
    .subscribe();

  return () => subscription.unsubscribe();
}, [chatId]);
```

### Send Message
```typescript
const sendMessage = async (content) => {
  const { data: savedMessage } = await supabase
    .from('messages')
    .insert([{
      chat_id: chatId,
      sender_id: userId,
      content
    }])
    .select()
    .single();

  // Broadcast triggers automatically via Postgres Changes
  // OR manually broadcast for instant UI:
  channel.send({
    type: 'broadcast',
    event: 'new-message',
    payload: savedMessage
  });
};
```

### Track Presence & Typing
```typescript
const channel = supabase.channel(`chat-${chatId}`);

// Track presence
channel.on('presence', { event: 'sync' }, () => {
  setActiveUsers(Object.values(channel.presenceState()).flat());
}).subscribe();

// Track current user
channel.track({ user_id: userId, username: userName });

// Debounced typing indicator
let typingTimeout;
const handleInput = () => {
  clearTimeout(typingTimeout);
  channel.send({
    type: 'broadcast',
    event: 'user-typing',
    payload: { user_id: userId }
  });
  typingTimeout = setTimeout(() => {
    channel.send({
      type: 'broadcast',
      event: 'user-stopped-typing',
      payload: { user_id: userId }
    });
  }, 5000);
};
```

---

## 5. Rate Limits by Plan

| Plan | Connections | Messages/sec | Broadcast Payload |
|------|-------------|--------------|-------------------|
| Free | 200 | 100 | 256 KB |
| Pro | 500 | 500 | 256 KB |
| Team/Pro+ | 10,000 | 2,500 | 3,000 KB |
| Enterprise | Custom | Custom | Custom |

**All limits configurable per project. Contact support for increases.**

---

## 6. File Storage Integration

### Upload & Store Reference
```typescript
// 1. Upload file to Storage
const { data: storageFile } = await supabase.storage
  .from('chat-files')
  .upload(`${chatId}/${fileName}`, file);

// 2. Store metadata + file path in message
const { data: message } = await supabase
  .from('messages')
  .insert([{
    chat_id: chatId,
    sender_id: userId,
    content: `File: ${fileName}`,
    file_path: storageFile.path,
    file_type: file.type,
    file_size: file.size
  }])
  .select();
```

### Serve Files
```typescript
// Public file URL (cached globally via CDN)
const publicUrl = supabase.storage
  .from('chat-files')
  .getPublicUrl(filePath).data.publicUrl;

// Private file (signed URL, expires after duration)
const { data } = supabase.storage
  .from('chat-files')
  .createSignedUrl(filePath, 3600); // 1 hour
```

**Storage limits:** 5 GB per file, files served from 285+ global edge locations

---

## 7. Edge Functions for Agents

### Webhook-Triggered AI Response
```typescript
// messages.INSERT → triggers Edge Function
export default async (req, context) => {
  const { record } = await req.json(); // New message

  // Call LLM
  const aiResponse = await fetch('https://api.openai.com/...', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}` },
    body: JSON.stringify({
      messages: [{ role: 'user', content: record.content }]
    })
  });

  const { choices } = await aiResponse.json();

  // Save bot response
  const supabase = createClient();
  await supabase.from('messages').insert({
    chat_id: record.chat_id,
    sender_id: botUserId,
    content: choices[0].message.content
  });
};
```

---

## 8. Authentication Setup

### Create User (Backend Only)
```typescript
const supabase = createClient(url, serviceRoleKey); // Service role!

const { data: user } = await supabase.auth.admin.createUser({
  email: 'user@example.com',
  password: 'secure-password',
  email_confirm: true
});
```

### Client Login
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});

// Token automatically sent with every request
```

### Custom JWT Claims (Admin)
```typescript
// Custom Access Token Hook (configure in Auth settings)
// Adds user role before token is issued

SELECT role FROM user_roles WHERE user_id = auth.uid()
// Now RLS policies can use: (auth.jwt() ->> 'role') = 'admin'
```

---

## 9. Testing Checklist

- [ ] RLS policies tested for all user types (owner, member, stranger)
- [ ] Message persists to DB AND appears in real-time
- [ ] New users joining chat see message history
- [ ] Presence tracks join/leave events
- [ ] Typing indicator debounced (max 1 broadcast per 3-5 sec)
- [ ] File uploads work with storage + message reference
- [ ] Rate limits enforced (connection limits, message throughput)
- [ ] Offline behavior: messages queue locally, sync on reconnect
- [ ] Multiple browser tabs: share same Realtime connection
- [ ] Auth tokens refresh automatically

---

## 10. Performance Tips

1. **Add indexes on foreign keys:**
   ```sql
   CREATE INDEX idx_messages_chat_id ON messages(chat_id);
   CREATE INDEX idx_channel_members_user_channel ON channel_members(user_id, channel_id);
   ```

2. **Use JWT claims for RLS filtering:**
   - Store `org_id`, `role` in token claims
   - RLS references token, not database queries
   - Faster than subquery-based policies

3. **Message batching for high throughput:**
   - Client buffers messages if >10/sec
   - Send batch every 100ms

4. **Connection pooling for Edge Functions:**
   - PgBouncer config to avoid connection exhaustion
   - Especially important for serverless

5. **Limit subscription scope:**
   - Subscribe to `messages:chat_id=eq.{chatId}` (filtered at server)
   - Not `messages` (all messages)

---

## 11. Known Limitations & Workarounds

| Limitation | Workaround |
|-----------|-----------|
| Broadcast not guaranteed | Always persist to DB first |
| No E2EE built-in | Implement client-side encryption |
| Connection limits per plan | Upgrade plan or batch connections |
| No message queue guarantee | Sort by created_at + id client-side |
| No full-text search | Use PostgreSQL FTS or external search |

---

## 12. Resources

- Official Realtime Chat: https://supabase.com/ui/docs/nextjs/realtime-chat
- Flutter Example: https://github.com/supabase-community/flutter-chat
- AI Chatbot Template: https://github.com/supabase-community/vercel-ai-chatbot
- Comprehensive Research: See `research-supabase-realtime-chat.md`

