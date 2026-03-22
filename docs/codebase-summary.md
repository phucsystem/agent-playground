# Codebase Summary

**Generated:** 2026-03-23
**Repomix output:** `./repomix-output.xml`
**Version:** 1.4.1
**Status:** ✅ Phases 1-6 complete + GoClaw WebSocket migration (Phase 7). React Query v5 performance migration + localStorage persister. All core features + workspace support + agent health + notifications + mobile responsiveness + optimized data caching + GoClaw WebSocket streaming integration with agent lifecycle events implemented.

## Overview

Agent Playground is a ~8,000 LOC Next.js chat application with Supabase backend + webhook agent integration + GoClaw bridge + workspace support + notifications + multi-device sessions. Organized into 77+ source files across app pages, components, hooks, contexts, utilities, 23 database migrations, and 1 Supabase Edge Function.

## File Counts & Distribution

| Category | Count | Files |
|----------|-------|-------|
| **App Pages** | 15 | login/page.tsx, chat/layout.tsx, chat/page.tsx, [conversationId]/page.tsx, setup/page.tsx, admin/page.tsx, admin/webhooks/page.tsx, changelog/layout.tsx, changelog/page.tsx, api/auth/login/route.ts, api/auth/logout/route.ts, api/agents/health/route.ts, api/conversations/[conversationId]/route.ts, api/goclaw/bridge/route.ts, api/goclaw/test/route.ts, global-error.tsx, middleware.ts |
| **Components** | 34 | chat (18: message-list, message-item, chat-input, chat-header, markdown-content, file-card, image-preview, url-preview, chat-info-panel, message-reactions, typing-indicator, emoji-picker, gif-picker, mention-picker, snippet-modal, message-list-skeleton, agent-thinking-indicator, confirm-delete-dialog), sidebar (10: sidebar, user-profile, online-users, conversation-list, create-group-dialog, workspace-rail, collapsible-section, all-users, search-input, conversation-list-skeleton), admin (5: webhook-config-form, agent-webhook-actions, workspace-settings, workspace-members, edit-user-dialog), changelog (1: release-body), profile (1: avatar-editor-dialog), ui (6: avatar, workspace-avatar, agent-health-toast, presence-toast, flip-loader, skeleton) |
| **Hooks** | 21+ | use-current-user, use-conversations, use-realtime-messages, use-supabase-presence, use-file-upload, use-conversation-members, use-typing-indicator, use-agent-thinking, use-reactions, use-agent-configs, use-webhook-logs, use-avatar-upload, use-pinned-conversations, use-mobile-sidebar, use-workspace-unread, use-notification-sound, use-notification-context, use-agent-health, use-agent-health-context, use-typewriter, use-conversation-order |
| **Contexts** | 2 | workspace-context.tsx, presence-context.tsx |
| **Library/Utils** | 5 | auth.ts, crop-image.ts, supabase/client.ts, supabase/server.ts, middleware.ts |
| **Types** | 1 | database.ts (generated from schema) |
| **Migrations** | 23 | 001_initial, 002_user_role, 003_admin_management, 004_mock_flag, 005_security_fixes, 006_fix_rls_recursion, 007_agent_webhooks, 008_webhook_debug_columns, 009_create_group_function, 010_archive_group, 011_get_conversation_members_fn, 012_admin_only_create_group, 013_user_sessions, 014_agent_health_check_url, 015_notification_preferences, 016_admin_delete_conversation, 017_conversations_realtime, 018_workspaces, 019_workspace_color, 020_avatar_storage, 021_*, 022_*, 023_agent_configs_metadata |
| **Edge Functions** | 1 | webhook-dispatch/index.ts |
| **Seed Data** | 1 | seed.sql (6 users, 2 conversations, 10 messages, 2 webhook configs) |
| **Config** | 4 | tsconfig.json, package.json, next.config.ts, postcss.config.mjs |
| **Docs** | 8 | SRD.md, UI_SPEC.md, DB_DESIGN.md, API_SPEC.md, system-architecture.md, codebase-summary.md, project-overview-pdr.md, project-roadmap.md |
| **Total** | 78+ | Source files + config |

## Directory Structure

```
agent-playground/
├── src/
│   ├── app/
│   │   ├── login/page.tsx               # Token entry form
│   │   ├── setup/page.tsx               # Avatar picker + nickname (first login)
│   │   ├── admin/
│   │   │   ├── page.tsx                # User management (admin only)
│   │   │   └── webhooks/page.tsx       # Webhook delivery logs (admin only)
│   │   ├── chat/
│   │   │   ├── layout.tsx               # Sidebar + main layout
│   │   │   ├── page.tsx                 # Empty chat state
│   │   │   └── [conversationId]/page.tsx # DM or group chat
│   │   ├── changelog/
│   │   │   ├── layout.tsx               # Changelog page layout
│   │   │   └── page.tsx                 # GitHub release notes display
│   │   ├── api/auth/login/route.ts      # POST /api/auth/login
│   │   ├── api/auth/logout/route.ts     # POST /api/auth/logout
│   │   ├── api/agents/health/route.ts   # GET /api/agents/health
│   │   ├── api/conversations/[conversationId]/route.ts  # DELETE conversation (admin)
│   │   ├── api/goclaw/
│   │   │   ├── bridge/route.ts          # POST /api/goclaw/bridge (webhook bridge to GoClaw)
│   │   │   └── test/route.ts            # GET /api/goclaw/test (health check proxy)
│   │   ├── layout.tsx                   # Root layout
│   │   ├── page.tsx                     # Redirect to /chat
│   │   ├── middleware.ts                # Auth guard
│   │   └── globals.css                  # Tailwind styles
│   ├── components/
│   │   ├── chat/
│   │   │   ├── message-list.tsx         # Infinite scroll container
│   │   │   ├── message-item.tsx         # Individual message (self/other) + streaming status + agent lifecycle events (run.started, tool.call, tool.result)
│   │   │   ├── chat-input.tsx           # Text + file attachment
│   │   │   ├── chat-header.tsx          # Conversation title + member count
│   │   │   ├── markdown-content.tsx     # react-markdown renderer
│   │   │   ├── file-card.tsx            # File download link
│   │   │   ├── image-preview.tsx        # Thumbnail + lightbox
│   │   │   ├── url-preview.tsx          # Open Graph metadata card
│   │   │   ├── chat-info-panel.tsx      # Members + files slide-over
│   │   │   ├── message-reactions.tsx    # Emoji reaction counts + add button
│   │   │   ├── typing-indicator.tsx     # Animated typing dots
│   │   │   ├── emoji-picker.tsx         # Emoji selection popover
│   │   │   ├── gif-picker.tsx           # GIF search + selection popover
│   │   │   ├── mention-picker.tsx       # @mention autocomplete dropdown
│   │   │   └── confirm-delete-dialog.tsx # Confirmation dialog for delete actions
│   │   ├── changelog/
│   │   │   └── release-body.tsx         # GitHub release markdown renderer
│   │   ├── admin/
│   │   │   ├── webhook-config-form.tsx  # Webhook URL + secret inline form
│   │   │   ├── agent-webhook-actions.tsx # Toggle, edit, view logs for agent rows
│   │   │   ├── workspace-settings.tsx   # Workspace name/color settings panel
│   │   │   ├── workspace-members.tsx    # Manage workspace members
│   │   │   └── edit-user-dialog.tsx     # Admin edit user modal
│   │   ├── sidebar/
│   │   │   ├── sidebar.tsx              # Main container
│   │   │   ├── user-profile.tsx         # Current user + logout
│   │   │   ├── online-users.tsx         # Presence list (filtered by mock flag)
│   │   │   ├── conversation-list.tsx    # Sorted by updated_at
│   │   │   ├── create-group-dialog.tsx  # Modal to create group
│   │   │   ├── workspace-rail.tsx       # Left workspace switcher rail
│   │   │   ├── collapsible-section.tsx  # Expandable sidebar section wrapper
│   │   │   └── all-users.tsx            # Full user directory listing
│   │   ├── profile/
│   │   │   └── avatar-editor-dialog.tsx # Image crop (react-easy-crop) + DiceBear generation
│   │   └── ui/
│   │       ├── avatar.tsx               # Reusable avatar component
│   │       ├── workspace-avatar.tsx     # Workspace icon with color/initials
│   │       ├── agent-health-toast.tsx   # Agent health status toast notification
│   │       ├── presence-toast.tsx       # Online/offline presence notifications
│   │       └── flip-loader.tsx          # Animated flip loader spinner
│   ├── contexts/
│   │   ├── workspace-context.tsx        # Active workspace state + switcher
│   │   └── presence-context.tsx         # Online presence state provider
│   ├── hooks/
│   │   ├── use-current-user.ts          # Fetch & cache user profile (+ refreshUser)
│   │   ├── use-conversations.ts         # Fetch all conversations
│   │   ├── use-realtime-messages.ts     # Subscribe to postgres_changes
│   │   ├── use-supabase-presence.ts     # Track & listen to online status
│   │   ├── use-file-upload.ts           # Upload to Storage + create record
│   │   ├── use-conversation-members.ts  # Fetch conversation participants
│   │   ├── use-typing-indicator.ts      # Broadcast & listen to typing
│   │   ├── use-agent-thinking.ts        # Track agent thinking state (client-side heuristic)
│   │   ├── use-reactions.ts             # Add/remove emoji reactions
│   │   ├── use-agent-configs.ts         # CRUD agent webhook configs
│   │   ├── use-webhook-logs.ts          # Fetch + filter webhook delivery logs
│   │   ├── use-avatar-upload.ts         # Upload avatar to storage bucket + update user
│   │   ├── use-pinned-conversations.ts  # localStorage-based conversation pinning
│   │   ├── use-mobile-sidebar.tsx       # Mobile sidebar visibility context provider
│   │   ├── use-workspace-unread.ts      # Unread count aggregated per workspace
│   │   ├── use-notification-sound.ts    # Play/mute notification sound on new messages
│   │   ├── use-notification-context.tsx # Notification preferences context provider
│   │   ├── use-agent-health.ts          # Poll agent health check endpoint
│   │   ├── use-agent-health-context.tsx # Agent health state context provider
│   │   └── use-typewriter.ts            # Typewriter animation for streaming text
│   ├── lib/
│   │   ├── auth.ts                      # getCurrentUser() helper
│   │   ├── crop-image.ts                # getCroppedImage() canvas utility
│   │   ├── goclaw/
│   │   │   ├── ws-client.ts             # GoClaw WebSocket client (persistent singleton, reconnect, stream/send)
│   │   │   └── index.ts                 # Singleton factory (getGoclawClient)
│   │   ├── supabase/
│   │   │   ├── client.ts                # Browser Supabase client
│   │   │   ├── server.ts                # Server Supabase client
│   │   │   └── middleware.ts            # Session validation
│   │   └── middleware.ts                # Next.js middleware (auth guard)
│   ├── types/
│   │   └── database.ts                  # Generated TypeScript types
│   └── middleware.ts                    # Enforce /chat/* requires auth
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql       # All tables, enums, RLS, functions
│   │   ├── 002_add_user_role.sql        # Add role column
│   │   ├── 003_admin_user_management.sql # Admin functions
│   │   ├── 004_add_mock_flag.sql        # Add is_mock, update RLS
│   │   ├── 005_security_fixes.sql       # DEFINER helpers, users_public view, signed URLs
│   │   ├── 006_fix_rls_recursion.sql    # Replace recursive policies with helpers
│   │   ├── 007_agent_webhooks.sql       # agent_configs, webhook_delivery_logs, trigger
│   │   ├── 008_webhook_debug_columns.sql # Debug/retry columns
│   │   ├── 009_create_group_function.sql # Group creation RPC
│   │   ├── 010_archive_group.sql        # Group archive support
│   │   ├── 011_get_conversation_members_fn.sql # Members RPC
│   │   ├── 012_admin_only_create_group.sql # Restrict group creation to admins
│   │   ├── 013_user_sessions.sql        # Multi-device session tracking
│   │   ├── 014_agent_health_check_url.sql # Agent health check URL
│   │   ├── 015_notification_preferences.sql # Per-user notification settings
│   │   ├── 016_admin_delete_conversation.sql # Admin delete conversation
│   │   ├── 017_conversations_realtime.sql # Realtime on conversations
│   │   ├── 018_workspaces.sql           # Workspaces + workspace_members
│   │   ├── 019_workspace_color.sql      # Workspace color column
│   │   └── 020_avatar_storage.sql       # Public avatars bucket + RLS
│   ├── functions/
│   │   └── webhook-dispatch/index.ts    # Webhook dispatch Edge Function (Deno)
│   └── seed.sql                         # Test data (6 users, 2 conversations, webhook configs)
├── src/app/
│   ├── icon.svg                         # Blue bot favicon (SVG)
│   ├── ...
├── docs/
│   ├── SRD.md                           # System requirements
│   ├── UI_SPEC.md                       # Design system + screens (S-01 to S-07)
│   ├── DB_DESIGN.md                     # Schema, RLS, DEFINER helpers, migrations
│   ├── API_SPEC.md                      # REST + Realtime endpoints
│   ├── system-architecture.md           # Architecture diagrams + flows
│   ├── project-overview-pdr.md          # Product design requirements + project overview
│   ├── project-roadmap.md               # Development phases + milestone tracking
│   └── codebase-summary.md              # This file
├── package.json                         # Next.js 16, React 19, Supabase 2.99
├── next.config.ts                       # Next.js config
├── tsconfig.json                        # TypeScript strict
├── postcss.config.mjs                   # Tailwind CSS 4
├── Dockerfile                           # Optional container
├── README.md                            # Project overview
└── .gitignore                           # Exclude .env.local, node_modules
```

## Key Patterns

### GoClaw WebSocket Bridge

Server-side persistent WebSocket connection to GoClaw for streaming agent responses. Singleton client created on first bridge request, manages connection state, reconnect with exponential backoff, message queuing, and request/response matching via request IDs.

**Client Features:**
- **Connection management:** Exponential backoff reconnect (max 30s), queued messages during reconnect, auth handshake via `token` and `user_id`
- **Request/response:** `send()` for RPC-style requests, returns Promise
- **Streaming:** `stream()` for chunked responses, calls `onChunk` callback per message, timeout 120s
- **Event subscriptions:** `on(eventType, callback)` for lifecycle events (run.started, tool.call, tool.result), returns unsubscribe function
- **Graceful shutdown:** `close()` cleans up pending requests, timers, WebSocket

**Bridge Route** (`/api/goclaw/bridge`):
1. Bearer token auth check (webhook_secret)
2. SSRF check on GOCLAW_URL (blocks localhost, private IPs)
3. Create streaming message with `streaming_status: "streaming"`
4. Subscribe to lifecycle events → debounced metadata updates (500ms)
5. `chat.stream()` with chunk callback (debounced 200ms content updates)
6. Final PATCH with `streaming_status: "complete"`

**Streaming UI:**
- `StreamingContent` component shows typing dots while streaming
- `AgentTextContent` applies typewriter animation post-stream
- Metadata includes `streaming_status` ("streaming"|"complete"|"error") and `agent_status` ("Thinking..."|"Calling: toolName"|"Processing results...")
- Real-time updates via Supabase Realtime postgres_changes

### React Query v5 Data Layer (TanStack Query)

All data fetching and realtime subscriptions via custom hooks built on TanStack Query v5. Three-tier caching strategy: localStorage (cross-session), in-memory (stale-while-revalidate), realtime (surgical updates). No blank screens during navigation or workspace switches.

**QueryClient Configuration** (`src/app/query-provider.tsx`):
- **staleTime:** 60s default, 30s conversations, Infinity messages
- **gcTime:** 30min (garbage collection, formerly cacheTime)
- **retry:** 1 attempt on network error
- **refetchOnWindowFocus:** disabled (avoid stale refetch on browser tab focus)
- **refetchOnReconnect:** enabled (recover after network loss)
- **ReactQueryDevtools:** enabled in dev mode for cache inspection

**localStorage Persister** (`src/lib/query-client.ts`):
- **conversations** cached per workspace, 24h TTL
- Persists across browser sessions — open app → instant conversation list
- Stale queries refetched in background after hydration
- Eliminates cold-start delay on first load

**Query Hooks (TanStack Query v5):**
- **use-conversations** — `useQuery(['conversations', workspaceId])` + 6 realtime subscription channels (messages INSERT, conversation CRUD, members)
- **use-realtime-messages** — `useInfiniteQuery(['messages', conversationId])` + surgical setQueryData (append to pages, no full refetch)

**Subscription Hooks (realtime-driven, custom):**
- **use-current-user** — Fetch user profile, manual cache invalidation
- **use-supabase-presence** — Manage online status broadcast
- **use-file-upload** — Storage upload + metadata
- **use-conversation-members** — List group members + realtime sync
- **use-typing-indicator** — Broadcast & listen to typing
- **use-reactions** — Add/remove emoji reactions + optimistic updates
- **use-pinned-conversations** — Manage localStorage-based conversation pinning
- **use-mobile-sidebar** — Control mobile sidebar visibility via context provider
- **use-avatar-upload** — Upload avatar blob to storage bucket + update user profile
- **use-workspace-unread** — Aggregate unread counts per workspace
- **use-notification-sound** — Play/mute audio on new message
- **use-notification-context** — Notification preferences context
- **use-agent-health** — Poll /api/agents/health every 5min, state transitions tracked
- **use-agent-health-context** — Agent health state distributed via context
- **use-typewriter** — Typewriter text animation for streaming responses
- **use-conversation-order** — DnD reordering with localStorage persistence

**Realtime Cache Update Strategy:**
- **postgres_changes INSERT messages** — setQueryData appends to conversation's message pages, prevents duplicate via `msg.id` check
- **postgres_changes CRUD conversations** — queryKey includes workspaceId (isolation), full refetch on type change
- **membership changes** — Refresh conversation members, update cache
- No full refetch except on conversation type/membership changes

**Performance Improvements:**
- Workspace switching: Stale conversations display immediately, background refetch queued
- Conversation switching: Cached messages render at 0ms, paginated load more on scroll
- Realtime updates: setQueryData surgical appends (1-2 pages) instead of full refetch
- Deduplication: Realtime handler checks `msg.id` against cached pages
- localStorage eliminates cold-start spinner (conversations pre-fetched from disk)
- No full-page refresh on route change (preserved scroll, focus, message load state)

**Skeleton Screens:**
- `src/components/ui/skeleton.tsx` — Base Tailwind animate-pulse component
- `src/components/sidebar/conversation-list-skeleton.tsx` — 6-8 shimmer rows during initial load
- `src/components/chat/message-list-skeleton.tsx` — 5-6 alternating message bubbles during initial load

Components receive clean data/callbacks. No fetch logic in components.

### Supabase Client Organization

| File | Purpose |
|------|---------|
| `lib/supabase/client.ts` | Browser-side singleton (anon key) |
| `lib/supabase/server.ts` | Server-side client (service role) |
| `lib/supabase/middleware.ts` | Validates JWT in middleware |

### Authentication Flow

```
Login Form (login/page.tsx)
    ↓ checks localStorage for cached token
    ↓ if cached, auto-login attempt (spinner shown)
    ↓ if none or invalid, token entry form
    ↓ POST {token}
API Route (api/auth/login/route.ts)
    ↓ rpc/login_with_token
Supabase (exchanges token for JWT)
    ↓ sets secure cookie, saves token to localStorage
Middleware (validates JWT)
    ↓ first-time redirect → /setup
Setup Page (setup/page.tsx)
    ↓ avatar + nickname (placeholder email/name pre-filled)
Protected Routes (/chat/*)
    ↓ render with currentUser
Logout (both src/lib/auth.ts and sidebar.tsx)
    ↓ clears localStorage token
```

### Realtime Architecture

**Conversation Context** (per-conversation subscriptions):
- 6 channels per active conversation via `use-conversations` hook

| Channel | Event | Handler | Use Case |
|---------|-------|---------|----------|
| `messages:{conversationId}` INSERT | postgres_changes | setQueryData append to pages | New message (no refetch) |
| `conversations:{workspaceId}` CRUD | postgres_changes | queryClient.invalidateQueries | Conversation created/renamed/deleted |
| `conversation_members:{conversationId}` * | postgres_changes | queryKey with conversationId | Member added/removed/role changed |
| `online-users` | presence sync/join/leave | React state | Online status sidebar + toasts |
| `typing:{conversationId}` | broadcast | React state | Typing indicator |
| `reactions:{conversationId}` | postgres_changes | setQueryData update message | Emoji reactions (all events) |

**Surgical Cache Updates:**
- Messages INSERT: Appends to conversation's message pages (O(1) operation)
- Prevents duplicates via `msg.id` check against cached pages
- Membership/type changes: Full conversation refresh (rare)
- 30-50 ms latency per update

### Component Architecture

Presentational components accept props/callbacks, no direct API calls:

```typescript
<MessageList
  messages={messages}
  onLoadMore={loadEarlierMessages}
  onReact={(messageId, emoji) => addReaction(messageId, emoji)}
/>

const { messages, reactions } = useRealtimeMessages(conversationId);
const { addReaction } = useReactions();
```

### File Upload Flow

1. Chat input detects file → calls `useFileUpload`
2. Hook uploads to Storage: `attachments/{conversationId}/{messageId}/{filename}`
3. Hook creates message record with metadata
4. Realtime fires postgres_changes
5. Component renders based on `content_type`

### Avatar Upload Flow

1. User clicks avatar in sidebar → opens `AvatarEditorDialog`
2. Two tabs: **Upload** (crop with react-easy-crop) or **Generate** (DiceBear styles)
3. Upload: `getCroppedImage()` creates canvas crop → WebP blob → `useAvatarUpload`
4. Hook uploads to Storage: `avatars/{userId}/avatar.webp`
5. Hook updates `users.avatar_url` with public URL + cache-bust query param
6. `use-current-user` refreshUser() called via `onAvatarSaved` callback
7. User profile reflects new avatar

### Mobile Responsive Architecture

**MobileSidebarProvider** context (use-mobile-sidebar.tsx):
- Provides `isSidebarOpen` state and `toggleSidebar` callback
- Wraps chat/layout.tsx at root
- On mobile (sm: breakpoint), sidebar slides as overlay
- Hamburger menu toggles visibility

**Responsive Breakpoints:**
- `sm:` — mobile devices (640px+)
- `md:` — tablets (768px+)
- `lg:` — desktops (1024px+)

### Conversation Pinning Pattern

**Storage:** Browser localStorage key `pinned_conversations_{userId}`
**State:** Array of conversation IDs pinned by user
**Hook:** `usePinnedConversations` reads/writes to localStorage
**UI:** Sidebar conversation list sorts pinned conversations to top
**No Database:** Pinning is client-side preference, not synced across devices

### Presence Toast Flow

**Trigger:** use-supabase-presence detects online/offline status change
**Components:** presence-toast.tsx displays dismissible toast via Sonner
**Payload:** { user_id, display_name, avatar_url, status: 'online'|'offline' }
**Latency:** <2s (Supabase presence sync)

## Dependencies (Core)

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.1.6 | Framework |
| react | 19.2.4 | UI |
| typescript | 5.9.3 | Type safety |
| @tanstack/react-query | 5.90.21 | Data fetching + cache management |
| @tanstack/react-query-persist-client | 5.90.24 | localStorage persistence |
| @tanstack/react-query-devtools | 5.x | Dev tools for cache inspection |
| @tanstack/react-virtual | — | Message/conversation virtualization |
| @dnd-kit/* | — | Conversation drag-and-drop reordering |
| @supabase/supabase-js | 2.99.1 | Client SDK |
| @supabase/ssr | 0.9.0 | Session management |
| tailwindcss | 4.2.1 | Styling |
| react-markdown | 10.1.0 | Markdown rendering |
| remark-gfm | 4.0.1 | Tables, strikethrough |
| rehype-highlight | 7.0.2 | Code highlighting |
| lucide-react | 0.577.0 | Icons |
| sonner | — | Toast notifications |
| react-easy-crop | — | Image cropping UI |
| sentry | 10.43.0 | Error tracking + monitoring |

## Database Schema (8 Tables)

| Table | Role | Key Columns | Rows (seed) |
|-------|------|------------|-----------|
| `users` | User profiles (humans + agents) | `role` (admin/user/agent), `is_mock` (bool), `is_agent` (bool) | 6 |
| `conversations` | DM or group container | `type` (dm/group), `name` (nullable), `created_by` | 2 |
| `conversation_members` | Membership join table | `role` (admin/member), `joined_at`, `last_read_at` | 8 |
| `messages` | Chat messages | `content_type` (text/file/image/url), `metadata` (jsonb), `sender_id` | 10 |
| `attachments` | File metadata | `file_url`, `storage_path`, `file_size`, `file_type` | 0 |
| `reactions` | Emoji reactions | `emoji`, `user_id`, UNIQUE(message_id, user_id, emoji) | 0 |
| `agent_configs` | Webhook config per agent (Phase 5) | `webhook_url`, `webhook_secret`, `is_webhook_active`, `user_id` (unique) | 2 |
| `webhook_delivery_logs` | Delivery history per message (Phase 5) | `status` (pending/delivered/failed), `http_status`, `attempt_count`, `message_id`, `agent_id` | 0 |

**Custom Types:**
- `user_role` — `admin`, `user`, `agent`
- `conversation_type` — `dm`, `group`
- `member_role` — `admin`, `member`
- `content_type` — `text`, `file`, `image`, `url`
- `delivery_status` — `pending`, `delivered`, `failed` (Phase 5)

**RLS Enabled:** All tables. Uses SECURITY DEFINER helpers to prevent recursion.

## Database Migrations

| File | Changes |
|------|---------|
| 001_initial_schema | Create tables, enums, indexes, RLS, functions |
| 002_add_user_role | Add `role` (user_role enum) column |
| 003_admin_user_management | Admin-only functions for user management |
| 004_add_mock_flag | Add `is_mock` boolean, update presence RLS |
| 005_security_fixes | Add SECURITY DEFINER helpers, users_public view, signed URLs |
| 006_fix_rls_recursion | Replace recursive policies with DEFINER helpers |
| 007_agent_webhooks | Create agent_configs, webhook_delivery_logs tables, notify trigger |
| 008_webhook_debug_columns | Add debug/retry columns to webhook_delivery_logs |
| 009_create_group_function | Add RPC function for group creation |
| 010_archive_group | Add group archive/unarchive support |
| 011_get_conversation_members_fn | Add RPC to fetch conversation members |
| 012_admin_only_create_group | Restrict group creation to admin role |
| 013_user_sessions | Add multi-device session tracking table |
| 014_agent_health_check_url | Add health_check_url to agent_configs |
| 015_notification_preferences | Add per-user notification preference settings |
| 016_admin_delete_conversation | Add admin-only delete conversation function |
| 017_conversations_realtime | Enable realtime on conversations table |
| 018_workspaces | Create workspaces + workspace_members tables |
| 019_workspace_color | Add color column to workspaces |
| 020_avatar_storage | Create public avatars bucket with per-user RLS policies |

## Code Standards

### Naming Conventions

| Pattern | Example | Usage |
|---------|---------|-------|
| Files | `kebab-case` | `use-realtime-messages.ts` |
| Components | `PascalCase` | `<MessageList />` |
| Variables | `camelCase` | `conversationId`, `isLoading` |
| Database | `snake_case` | `created_at`, `is_agent` |
| Enums | `SCREAMING_SNAKE_CASE` | `CONVERSATION_TYPE` |

### File Size Limits

- **Components** — <150 LOC (split complex layouts)
- **Hooks** — <100 LOC (refactor large hooks)
- **Pages** — <50 LOC (composition over logic)

### TypeScript

- `strict: true` in tsconfig.json
- All function signatures typed
- Database types generated from schema
- No `any` without `// @ts-ignore`

### Styling

- Tailwind CSS 4 (no CSS modules)
- Design tokens in `globals.css`
- Dark mode ready (`:dark` prefix)
- Mobile-first responsive (sm:, md:, lg:)

## API Endpoints (Summary)

See `docs/API_SPEC.md` for complete reference.

| Method | Path | Feature | Phase |
|--------|------|---------|-------|
| POST | `/api/auth/login` | Token → JWT | P1 |
| GET | `/rest/v1/users` | User list (presence) | P1 |
| GET | `/rest/v1/users_public` | User list (admin view) | P4 |
| GET | `/rpc/get_my_conversations` | User's conversations | P1 |
| POST | `/rpc/find_or_create_dm` | Start/find DM | P1 |
| GET | `/rest/v1/messages?conversation_id=eq.{id}` | Message history | P1 |
| POST | `/rest/v1/messages` | Send message | P1 |
| POST | `/storage/v1/object/attachments/{path}` | Upload file | P2 |
| POST | `/rest/v1/conversations` | Create group | P2 |
| POST | `/rest/v1/reactions` | Add reaction | P3 |
| PATCH | `/rest/v1/users?id=eq.{id}` | Update profile | P4 |
| POST | `/rest/v1/agent_configs` | Create webhook config | P5 |
| PATCH | `/rest/v1/agent_configs?user_id=eq.{id}` | Update/toggle webhook | P5 |
| GET | `/rest/v1/agent_configs` | List webhook configs | P5 |
| GET | `/rest/v1/webhook_delivery_logs` | Query delivery logs | P5 |
| — | Edge Function: webhook-dispatch | Dispatch webhooks | P5 |
| POST | `/api/goclaw/bridge` | Webhook bridge to GoClaw | P7 |
| GET | `/api/goclaw/test` | GoClaw health check proxy | P7 |

## Implementation Phases

| Phase | Status | Features | Files |
|-------|--------|----------|-------|
| **P1: Chat** | ✅ Complete | Auth, DMs, groups, realtime, history | src/app/login, src/app/chat, src/components/chat, src/components/sidebar |
| **P2: Content** | ✅ Complete | Files, images, URLs, markdown | src/components/chat/* (file-card, image-preview, url-preview, markdown-content) |
| **P3: Polish** | ✅ Complete | Typing, read receipts, reactions | use-typing-indicator, use-reactions, reactions-display |
| **P4: Admin** | ✅ Complete | User management, setup wizard, mock flag | src/app/setup, src/app/admin, use-current-user |
| **P5: Webhooks** | ✅ Complete | Agent webhook config, dispatch, delivery logs | src/app/admin/webhooks, src/hooks/use-agent-configs, src/hooks/use-webhook-logs, supabase/functions/webhook-dispatch |
| **P6: Workspace + Polish** | ✅ Complete | Workspace support, agent health, notifications, mobile UX | workspace-rail, workspace-avatar, workspace-settings, workspace-members, all-users, collapsible-section, use-workspace-unread, use-pinned-conversations, use-mobile-sidebar, use-notification-sound, use-agent-health, flip-loader, presence-toast, agent-health-toast |
| **P7: GoClaw Integration** | ✅ Complete | GoClaw webhook bridge, agent metadata config, Bearer token auth, SSRF protection | src/app/api/goclaw/bridge, src/app/api/goclaw/test, webhook-config-form (GoClaw toggle), migration 023_agent_configs_metadata, middleware auth bypass |

## Important Notes

1. **Environment file not in repo** — Add `.env` with Supabase credentials before running (uses `.env` for all environments)
2. **RLS is security layer** — No application-level authorization checks needed
3. **Realtime requires PUBLISH** — Supabase free tier must have realtime enabled
4. **Service role in .env only** — Never expose to frontend
5. **Seed data uses fixed UUIDs** — Reproducible across deploys
6. **Mock users hidden from non-admins** — Sidebar filters by `is_mock` flag using RLS
7. **Signed URLs for file access** — Storage uses `createSignedUrl` not `getPublicUrl`
8. **SECURITY DEFINER helpers prevent RLS recursion** — Policies use helper functions instead of subqueries
9. **Token caching in localStorage** — Login token saved as `agent_playground_token`, enables auto-login on page revisit
10. **Simplified invite flow** — Admin generates token only; email (`invite-{shortId}@placeholder.local`) and display_name ("New User") auto-generated
11. **Stronger tokens** — 64-char with full charset (A-Za-z0-9!@#$%^&*()-_=+[]{}|;:<>?) using crypto.getRandomValues
12. **SVG favicon** — Blue bot icon at `src/app/icon.svg`, auto-detected by Next.js App Router
13. **Avatar storage** — Public Supabase bucket (`avatars`) with per-user RLS (upload/update own only, all can read)
14. **Avatar upload** — Two modes: upload photo (crop with react-easy-crop → WebP) or generate (17 DiceBear styles + randomize)
15. **Avatar URLs** — Cache-busted with `?t={timestamp}` to force fresh load after update

## Next Steps

- See `README.md` for quick start
- See `docs/API_SPEC.md` for API reference
- See `docs/DB_DESIGN.md` for schema details
- See `docs/system-architecture.md` for architectural flows
- See `docs/UI_SPEC.md` for design system and screens
