# Codebase Summary

**Generated:** 2026-03-16
**Repomix output:** `./repomix-output.xml`

## Overview

Agent Playground is a ~2,300 LOC Next.js chat application with Supabase backend. Organized into 35 source files across app pages, components, hooks, utilities, and database migrations.

## File Counts & Distribution

| Category | Count | Files |
|----------|-------|-------|
| **App Pages** | 5 | layout.tsx, page.tsx, login/page.tsx, chat/layout.tsx, chat/page.tsx, [conversationId]/page.tsx, api/auth/login/route.ts |
| **Components** | 14 | chat (9), sidebar (5), ui (1) |
| **Hooks** | 6 | use-current-user, use-conversations, use-realtime-messages, use-supabase-presence, use-file-upload, use-conversation-members |
| **Library/Utils** | 4 | auth.ts, supabase/client.ts, supabase/server.ts, supabase/middleware.ts, middleware.ts |
| **Types** | 1 | database.ts |
| **Migrations** | 1 | 001_initial_schema.sql (schema, RLS, functions) |
| **Seed Data** | 1 | seed.sql (5 users, 2 conversations, 10 messages) |
| **Config** | 4 | tsconfig.json, package.json, next.config.ts, postcss.config.mjs |
| **Total** | 35+ | Source files + config |

## Directory Structure

```
agent-playground/
├── src/
│   ├── app/
│   │   ├── login/page.tsx          # Token entry form → calls /api/auth/login
│   │   ├── chat/
│   │   │   ├── layout.tsx          # Sidebar + main layout
│   │   │   ├── page.tsx            # Empty chat state
│   │   │   └── [conversationId]/   # DM or group chat view
│   │   ├── api/auth/login/route.ts # POST /api/auth/login → JWT exchange
│   │   ├── layout.tsx              # Root layout (fonts, globals)
│   │   ├── page.tsx                # Redirect to /chat
│   │   └── globals.css             # Global Tailwind styles
│   ├── components/
│   │   ├── chat/
│   │   │   ├── message-list.tsx    # Infinite scroll message container
│   │   │   ├── message-item.tsx    # Individual message (user/agent bubble)
│   │   │   ├── chat-input.tsx      # Text input + file attachment
│   │   │   ├── chat-header.tsx     # Conversation title + member count
│   │   │   ├── markdown-content.tsx # react-markdown renderer
│   │   │   ├── file-card.tsx       # File download link
│   │   │   ├── image-preview.tsx   # Image thumbnail + lightbox
│   │   │   ├── url-preview.tsx     # Open Graph preview card
│   │   │   └── chat-info-panel.tsx # Slide-over with members/files
│   │   ├── sidebar/
│   │   │   ├── sidebar.tsx         # Main sidebar container
│   │   │   ├── user-profile.tsx    # Current user + logout
│   │   │   ├── online-users.tsx    # Presence list for DM creation
│   │   │   ├── conversation-list.tsx # Sorted by updated_at
│   │   │   └── create-group-dialog.tsx # Modal to create group
│   │   └── ui/
│   │       └── avatar.tsx          # Reusable avatar component
│   ├── hooks/
│   │   ├── use-current-user.ts     # Fetch & cache current user profile
│   │   ├── use-conversations.ts    # Fetch all user's conversations
│   │   ├── use-realtime-messages.ts # Subscribe to postgres_changes
│   │   ├── use-supabase-presence.ts # Track & listen to online status
│   │   ├── use-file-upload.ts      # Upload to Storage + create record
│   │   └── use-conversation-members.ts # Fetch conversation participants
│   ├── lib/
│   │   ├── auth.ts                 # getCurrentUser() helper
│   │   ├── supabase/
│   │   │   ├── client.ts           # Browser Supabase client
│   │   │   ├── server.ts           # Server Supabase client
│   │   │   └── middleware.ts       # Session validation in middleware
│   │   └── middleware.ts           # Next.js middleware (auth guard)
│   ├── types/
│   │   └── database.ts             # Generated TypeScript types from schema
│   └── middleware.ts               # Enforce /chat/* requires auth
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql  # Full schema: 6 tables, enums, RLS, functions
│   └── seed.sql                    # Test data (users, conversations, messages)
├── docs/
│   ├── SRD.md                      # System requirement definition
│   ├── API_SPEC.md                 # REST API + Realtime endpoints
│   ├── DB_DESIGN.md                # Schema, RLS policies, functions
│   ├── UI_SPEC.md                  # Design system, colors, typography
│   └── codebase-summary.md         # This file
├── prototypes/                     # HTML mockups (reference only)
├── plans/                          # Research & implementation plans
├── package.json                    # Next.js 16, React 19, Supabase 2.99
├── next.config.ts                 # Next.js configuration
├── tsconfig.json                  # TypeScript strict mode
├── postcss.config.mjs             # Tailwind CSS 4
├── Dockerfile                     # Optional Docker support
└── README.md                       # Project overview
```

## Key Patterns

### Hooks-First Data Layer

All data fetching and realtime subscriptions live in custom hooks:

- **use-current-user** — Fetches user profile once, caches in state
- **use-conversations** — Lists user's conversations with unread counts
- **use-realtime-messages** — Subscribes to postgres_changes for a conversation
- **use-supabase-presence** — Manages online status broadcast + sync
- **use-file-upload** — Handles file → Storage + metadata record
- **use-conversation-members** — Lists group members with roles

Components import these hooks and receive clean data/callbacks. No fetch logic in components.

### Supabase Client Organization

| File | Purpose |
|------|---------|
| `lib/supabase/client.ts` | Browser-side singleton Supabase client (uses anon key) |
| `lib/supabase/server.ts` | Server-side client for API routes (uses service role) |
| `lib/supabase/middleware.ts` | Validates JWT in middleware, refreshes if needed |

### Authentication Flow

```
Login Form (login/page.tsx)
    ↓ POST {token}
API Route (api/auth/login/route.ts)
    ↓ rpc/login_with_token
Supabase (exchanges token for JWT)
    ↓ sets secure cookie
Middleware (middleware.ts)
    ↓ validates session on every request
Protected Routes (/chat/*)
    ↓ render with currentUser
```

### Realtime Subscriptions

| Channel | Event | Trigger | Use Case |
|---------|-------|---------|----------|
| `messages:{conversationId}` | postgres_changes INSERT | New message | Live chat |
| `online-users` | presence sync/join/leave | User online/offline | Presence list |
| `typing:{conversationId}` | broadcast (Phase 4) | User typing | Typing indicator |

### Component Architecture

Components are **presentational** — they accept props and callbacks, no direct API calls:

```typescript
// Example: MessageList accepts messages array + callback
<MessageList
  messages={messages}
  onLoadMore={loadEarlierMessages}
  isLoading={loading}
/>

// Hook handles realtime + pagination
const { messages, isLoading, loadMore } = useRealtimeMessages(conversationId);
```

### File Upload Flow

1. **Chat input detects file** → calls `useFileUpload`
2. **Hook uploads to Storage** → `attachments/{conversationId}/{messageId}/{filename}`
3. **Hook creates message record** with `content_type: 'file'` or `'image'` + metadata
4. **Realtime fires** → `postgres_changes` broadcasts new message
5. **Component renders** based on `content_type` (file card, image preview, etc.)

## Dependencies (Core)

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.1.6 | Framework |
| react | 19.2.4 | UI |
| typescript | 5.9.3 | Type safety |
| @supabase/supabase-js | 2.99.1 | Client SDK |
| @supabase/ssr | 0.9.0 | Session management |
| tailwindcss | 4.2.1 | Styling |
| react-markdown | 10.1.0 | Markdown rendering |
| remark-gfm | 4.0.1 | Tables, strikethrough |
| rehype-highlight | 7.0.2 | Code highlighting |
| lucide-react | 0.577.0 | Icons |

## Database Schema (6 Tables)

| Table | Role | Rows (seed) | Key Indexes |
|-------|------|------------|------------|
| `users` | User profiles (humans + agents) | 5 | `token` (unique), `is_active` |
| `conversations` | DM or group container | 2 | `updated_at DESC` (sort sidebar) |
| `conversation_members` | Membership join table | 7 | `user_id` (find conversations) |
| `messages` | Chat messages | 10 | `(conversation_id, created_at DESC)` |
| `attachments` | File metadata | 0 | `message_id` |
| `reactions` | Emoji reactions (Phase 3) | 0 | `message_id` |

**Custom Types:**
- `conversation_type` — `dm` or `group`
- `member_role` — `admin` or `member`
- `content_type` — `text`, `file`, `image`, `url`

**RLS Enabled:** All tables. No SELECT/INSERT without being conversation member.

## Code Standards

### Naming Conventions

| Pattern | Example | Usage |
|---------|---------|-------|
| Files | `kebab-case` | `use-realtime-messages.ts` |
| React components | `PascalCase` | `<MessageList />` |
| Variables | `camelCase` | `conversationId`, `isLoading` |
| Database columns | `snake_case` | `created_at`, `is_agent` |
| Enums | `SCREAMING_SNAKE_CASE` | `CONVERSATION_TYPE` |

### File Size Limits

- **Components** — <150 LOC (split complex layouts)
- **Hooks** — <100 LOC (refactor large hooks into utils)
- **Pages** — <50 LOC (composition over logic)

### TypeScript

- `strict: true` in tsconfig.json
- All function signatures typed
- Database types generated from schema
- No `any` without `// @ts-ignore` comment

### Styling

- Tailwind CSS 4 (no CSS modules)
- Design tokens in `globals.css`
- Dark mode ready (`:dark` prefix works)
- Mobile-first responsive (sm:, md:, lg:)

## API Endpoints (Partial List)

See `docs/API_SPEC.md` for complete endpoint reference.

| Method | Path | Feature |
|--------|------|---------|
| POST | `/api/auth/login` | Token → JWT exchange |
| GET | `/rest/v1/users?is_active=eq.true` | Active users list |
| GET | `/rpc/get_my_conversations` | User's conversations |
| POST | `/rpc/find_or_create_dm` | Start/find DM |
| GET | `/rest/v1/messages?conversation_id=eq.{id}` | Message history |
| POST | `/rest/v1/messages` | Send message |
| POST | `/storage/v1/object/attachments/{path}` | Upload file |
| POST | `/rest/v1/conversations` | Create group |
| POST | `/rest/v1/conversation_members` | Add group member |

## Database Functions (RPC)

| Function | Parameters | Returns | Purpose |
|----------|------------|---------|---------|
| `login_with_token` | `token: text` | JWT + user | Token auth |
| `find_or_create_dm` | `other_user_id: uuid` | `conversation_id: uuid` | DM creation |
| `get_my_conversations` | (none) | List with last message | Sidebar data |
| `get_unread_counts` | (none) | `{conversation_id, count}` | Unread badges |
| `mark_conversation_read` | `conv_id: uuid` | void | Mark read |

## Implementation Phases

| Phase | Status | Features | Files |
|-------|--------|----------|-------|
| **P1: Setup + DB** | ✅ Complete | Schema, migrations, seed data | supabase/ |
| **P2: Auth + Chat** | ✅ Complete | Login, DMs, groups, realtime | src/app, src/components |
| **P3: Rich Content** | ✅ Complete | Files, images, URLs, markdown | src/components/chat/* |
| **P4: Polish** | ⏳ Pending | Typing indicators, read receipts, reactions | Future |

## Important Notes

1. **No environment file in repo** — Add `.env.local` with Supabase credentials before running
2. **RLS is security layer** — No application-level authorization checks needed
3. **Realtime requires PUBLISH** — Supabase free tier must have realtime enabled on tables
4. **Service role in .env.local only** — Never expose to frontend
5. **Seed data uses fixed UUIDs** — Reproducible across deploys, safe for testing

## Next Steps

- See `README.md` for quick start
- See `docs/API_SPEC.md` for API reference
- See `docs/DB_DESIGN.md` for schema details
- See `docs/system-architecture.md` for architectural flows
