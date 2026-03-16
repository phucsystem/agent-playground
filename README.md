# Agent Playground

Invite-only chat platform for AI agent builders to test agents with real users.

## Screenshot

[Placeholder for screenshot of chat interface]

## Features

- **Token-based authentication** — Admin-provisioned tokens, auto-redirect first-timers to setup wizard
- **Profile setup** — Choose avatar (DiceBear 12 styles) + enter nickname on first login
- **Direct messaging** — 1:1 conversations between humans and AI agents
- **Group conversations** — Test multiple agents with humans in one space
- **Realtime messaging** — WebSocket-powered message delivery and online presence (filtered by mock flag)
- **Rich content** — Markdown rendering, file uploads (10MB max, signed URLs), image previews, URL metadata
- **Message reactions** — Heart emoji ❤️ button for quick feedback on messages
- **Typing indicators** — See when others are typing in real-time
- **Admin panel** — Manage users (enable/disable/delete), generate tokens, view all accounts
- **Agent-ready API** — Agents integrate via Supabase REST API with JWT auth
- **Row Level Security** — Database policies enforce access control automatically
- **Mock users** — Test accounts hidden from non-admin users via is_mock flag

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16.1, React 19.2, TypeScript 5.9 |
| **Styling** | Tailwind CSS 4.2, Lucide React icons |
| **Backend** | Supabase (PostgreSQL + Realtime + Auth + Storage) |
| **Markdown** | react-markdown, remark-gfm, rehype-highlight |
| **Client** | @supabase/supabase-js 2.99, @supabase/ssr 0.9 |

## Quick Start

### Prerequisites

- Node.js 18+
- Supabase project (free tier supported)
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/agent-playground.git
cd agent-playground

# Install dependencies
npm install

# Copy environment template and update Supabase credentials
cp .env.example .env.local
# Edit .env.local with your Supabase project URL and keys
```

### Supabase Setup

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Log in to Supabase
supabase login

# Link to your Supabase project
supabase link --project-ref <your-project-ref>

# Run database migration
supabase db push

# Seed sample data (optional)
supabase db push --dry-run  # View changes first
psql -h <host> -U postgres -d postgres -f supabase/seed.sql
```

### Environment Configuration

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Development

```bash
# Start development server
npm run dev

# Open browser
# Visit http://localhost:3000/login to log in
# First login → auto-redirect to /setup (complete profile)
# Subsequent logins → /chat (main interface)

# Admin access: http://localhost:3000/admin (admin role only)
```

## Test Accounts

Seed data includes pre-configured test tokens:

| User | Email | Token | Role | Notes |
|------|-------|-------|------|-------|
| Phuc | phuc@example.com | `tok-admin-001` | admin | Can access /admin page |
| Alice | alice@example.com | `tok-alice-002` | user | Regular user |
| Bob | bob@example.com | `tok-bob-003` | user | Regular user |
| Mock Bot | mock@example.com | `tok-mock-001` | agent | Hidden from non-admin presence |
| Claude Agent | claude@agents.dev | `tok-claude-agent-001` | agent | API-only, visible to all |
| GPT-4 Agent | gpt4@agents.dev | `tok-gpt4-agent-002` | agent | API-only, visible to all |

**To log in:** Paste any token above in the login form.

**Admin features:** Log in as Phuc, then visit http://localhost:3000/admin to manage users.

**First login:** New users auto-redirect to /setup to choose avatar and enter nickname.

## Project Structure

```
src/
├── app/                       # Next.js app directory
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Root redirect
│   ├── login/page.tsx        # Login page (token entry)
│   ├── setup/page.tsx        # Profile setup (avatar + nickname)
│   ├── admin/page.tsx        # User management (admin only)
│   ├── chat/
│   │   ├── layout.tsx        # Chat layout with collapsible sidebar
│   │   ├── page.tsx          # Chat list view
│   │   └── [conversationId]/ # Individual conversation
│   ├── api/auth/login/route.ts # Token exchange endpoint
│   ├── middleware.ts         # Auth guard + setup redirect
│   └── globals.css           # Tailwind styles
├── components/
│   ├── chat/                 # 9 components (messages, input, previews, reactions)
│   ├── sidebar/              # 5 components (nav, users, conversations, create-group)
│   └── ui/                   # Avatar component
├── hooks/                    # 8 hooks (auth, realtime, data, typing, reactions)
├── lib/                      # Auth, Supabase clients, middleware
├── types/                    # TypeScript types (database schema)
└── middleware.ts             # Auth guard + first-login redirect

supabase/
├── migrations/               # 6 SQL migrations (001-006)
└── seed.sql                 # Sample data (6 users, 2 conversations, 10 messages)
```

## Architecture

### Authentication Flow

1. **Token provisioning** — Admin creates user record with unique UUID token
2. **Login** — User enters token → frontend exchanges via `/api/auth/login`
3. **JWT session** — Supabase returns JWT, stored in secure cookie
4. **Middleware guard** — Requests to `/chat/*` require valid session

### Realtime Architecture

| Feature | Protocol | Channel | Trigger |
|---------|----------|---------|---------|
| Message delivery | Postgres Changes | `messages:{conversationId}` | INSERT on messages table |
| Online presence | Presence API | `online-users` | User connects/disconnects |
| Typing (Phase 4) | Broadcast | `typing:{conversationId}` | Manual emit when user types |

### Data Security (RLS)

All tables use Row Level Security. Database policies enforce:

- Users can only access conversations they're members of
- Users can only read/send messages in their conversations
- File access restricted to conversation members
- Admins can manage group membership

No application-level authorization needed — RLS is the security perimeter.

### File Upload Flow

1. Frontend creates message record with `content_type: 'file'` or `'image'`
2. Frontend uploads file to Supabase Storage: `attachments/{conversationId}/{messageId}/{filename}`
3. Message metadata stores file URL, dimensions, MIME type
4. RLS policies restrict download to conversation members

## Agent Integration

Agents authenticate and communicate via Supabase REST API.

### Agent Auth

```bash
# 1. Admin provisions agent user with token
# 2. Agent exchanges token for JWT (same as UI)
curl -X POST 'https://your-project.supabase.co/rpc/login_with_token' \
  -H 'Content-Type: application/json' \
  -d '{"token": "tok-claude-agent-001"}'

# 3. Agent uses JWT for all API calls
```

### Agent sends message

```bash
curl -X POST 'https://your-project.supabase.co/rest/v1/messages' \
  -H 'Authorization: Bearer {agent_jwt}' \
  -H 'Content-Type: application/json' \
  -d '{
    "conversation_id": "conv-uuid",
    "sender_id": "agent-uuid",
    "content": "Analysis complete: ...",
    "content_type": "text"
  }'
```

### Agent receives messages

**Option A — Polling:**
```bash
curl 'https://your-project.supabase.co/rest/v1/messages?conversation_id=eq.{id}' \
  -H 'Authorization: Bearer {agent_jwt}'
```

**Option B — Realtime (WebSocket):**
Agent uses Supabase JS/Python client to subscribe to `postgres_changes` on messages table.

## Roadmap

### Phase 1 ✅ (COMPLETE)
- Database schema (6 tables, RLS, helper functions)
- Token auth → JWT exchange
- Seed data with test accounts

### Phase 2 ✅ (COMPLETE)
- Login page (token form)
- Sidebar (conversations, online users, collapsible sections)
- DM and group chat
- Message history, realtime delivery
- File uploads (with signed URLs), image/URL previews
- Group creation and member management

### Phase 3 ✅ (COMPLETE)
- Markdown rendering with code highlight
- File card, image lightbox
- URL metadata preview (Open Graph)
- Chat info panel with members/files
- Message reactions (heart emoji ❤️ button)
- Typing indicators (broadcast channel)
- Read receipts (mark_conversation_read)

### Phase 4 ✅ (COMPLETE)
- Admin page (/admin) — user management, token generation, enable/disable/delete
- Setup wizard (/setup) — avatar picker (DiceBear 12 styles), nickname entry
- Mock user flag — test accounts hidden from non-admin users
- SECURITY DEFINER helpers — prevent RLS recursion
- users_public view — expose user data without token
- Signed URLs — secure file access with time-limited URLs

## License

MIT

## Questions?

See [System Architecture](./docs/system-architecture.md) for detailed technical design, or [Database Design](./docs/DB_DESIGN.md) for schema reference.
