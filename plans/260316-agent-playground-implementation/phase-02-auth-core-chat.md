# Phase 2: Auth + Core Chat

## Context
- SRD: FR-01 through FR-09 (Phase 1 features)
- UI Spec: S-01 (Login), S-02 (Sidebar), S-03 (DM Chat)
- API Spec: Login, users list, conversations, messages, presence
- Prototypes: `prototypes/s01-login.html`, `s02-main-layout.html`, `s03-dm-chat.html`

## Overview
- **Priority:** P1
- **Status:** Pending
- **Effort:** 8h
- **Depends on:** Phase 1 (setup complete, DB deployed)
- Implement login flow, sidebar with presence, DM conversations, real-time messaging.

## Files to Create

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Redirect to /login or /chat |
| `src/app/login/page.tsx` | Login screen (S-01) |
| `src/app/chat/layout.tsx` | Chat layout with sidebar (S-02) |
| `src/app/chat/page.tsx` | Empty state "Select a conversation" |
| `src/app/chat/[conversationId]/page.tsx` | DM/Group chat view (S-03) |
| `src/components/sidebar/sidebar.tsx` | Main sidebar container |
| `src/components/sidebar/user-profile.tsx` | Current user profile section |
| `src/components/sidebar/online-users.tsx` | Presence list |
| `src/components/sidebar/conversation-list.tsx` | DM + Group list |
| `src/components/chat/chat-header.tsx` | Chat header (name, status, info btn) |
| `src/components/chat/message-list.tsx` | Scrollable message list |
| `src/components/chat/message-item.tsx` | Single message (avatar, name, content) |
| `src/components/chat/markdown-content.tsx` | Markdown renderer with code highlight |
| `src/components/chat/chat-input.tsx` | Input bar (textarea, send btn) |
| `src/hooks/use-supabase-presence.ts` | Presence hook |
| `src/hooks/use-realtime-messages.ts` | Realtime message subscription |
| `src/hooks/use-conversations.ts` | Fetch conversations + unread |
| `src/lib/auth.ts` | Auth helpers (login, logout, getSession) |

## Implementation Steps

### Step 1: Login page (FR-01, FR-02, S-01)

Match `prototypes/s01-login.html` exactly:
1. Centered card, token input (password-masked), sign in button
2. On submit: call Edge Function `/login-with-token`
3. Store JWT in cookies via Supabase SSR
4. Redirect to `/chat`
5. Error states: invalid token, disabled account
6. Auth middleware: redirect `/chat` → `/login` if no session, `/login` → `/chat` if valid session

### Step 2: Chat layout + sidebar shell (S-02)

Match `prototypes/s02-main-layout.html`:
1. `chat/layout.tsx`: flex layout with fixed 260px sidebar + flexible content
2. Sidebar sections: user profile (top), online users, DMs, groups, new chat btn
3. Empty state in main area: "Select a conversation to start chatting"
4. Responsive: sidebar collapses at 1023px, hides at 767px

### Step 3: Online presence (FR-03)

`use-supabase-presence.ts` hook:
1. Subscribe to `online-users` Presence channel
2. Track current user on subscribe
3. Listen for `sync`/`join`/`leave` events
4. Return `onlineUsers` array with `{ user_id, display_name, is_agent }`
5. Update `users.last_seen_at` on disconnect
6. Display in sidebar `online-users.tsx` with green dots

### Step 4: Conversation list (FR-04)

`use-conversations.ts` hook:
1. Call `get_my_conversations` RPC on mount
2. Return conversations sorted by `updated_at` DESC
3. Call `get_unread_counts` RPC for badge counts
4. Re-fetch on realtime message insert (any conversation)
5. Display in `conversation-list.tsx`: name, last message preview (40 chars), unread badge

### Step 5: Direct messaging - create DM (FR-05)

1. Click user in presence list → call `find_or_create_dm` RPC
2. Navigate to `/chat/{conversation_id}`
3. If DM already exists, navigate to existing

### Step 6: Message list + sending (FR-06, FR-07, FR-08)

`message-list.tsx`:
1. Fetch messages: `GET /rest/v1/messages?conversation_id=eq.{id}&order=created_at.desc&limit=50`
2. Join sender profile via `select=*,sender:users(...)`
3. Render each message via `message-item.tsx`
4. Message grouping: same sender within 5 min → hide repeated avatar/name
5. Infinite scroll up: load 50 more on scroll-to-top
6. Auto-scroll to bottom on new message (if at bottom)
7. "New messages" pill when scrolled up

`chat-input.tsx`:
1. Auto-growing textarea (Enter=send, Shift+Enter=newline)
2. Send: `POST /rest/v1/messages` with content_type='text'
3. Optimistic UI: append message immediately, confirm on server response
4. Disabled send button when empty

`use-realtime-messages.ts`:
1. Subscribe to `postgres_changes` INSERT on messages table filtered by conversation_id
2. On new message: append to message list
3. Fetch sender profile if not cached

### Step 7: Markdown rendering (FR-06)

`markdown-content.tsx`:
1. `react-markdown` with `remark-gfm` (tables, strikethrough) + `rehype-highlight` (code blocks)
2. Code blocks: light bg (`neutral-50`), copy button, blue bottom border accent
3. Links: clickable, `primary-500` color
4. Images in markdown: render inline

### Step 8: User profile display (FR-09)

`message-item.tsx`:
1. Avatar: 32px circle, initials fallback, bot badge for agents
2. Sender name: bold, agents in `primary-600`
3. Timestamp: relative within 1h ("2m ago"), then "10:32 AM"

### Step 9: Mark conversation as read

1. On conversation open: call `mark_conversation_read` RPC
2. Resets unread badge in sidebar
3. Call again on new message received while conversation is focused

## Todo List

- [ ] Login page with token auth + error states
- [ ] Auth middleware (redirect logic)
- [ ] Chat layout with sidebar shell
- [ ] User profile section in sidebar
- [ ] Online presence hook + sidebar display
- [ ] Conversation list hook + sidebar display
- [ ] Find/create DM on user click
- [ ] Message list with pagination + sender join
- [ ] Message sending with optimistic UI
- [ ] Realtime message subscription
- [ ] Markdown content renderer with code blocks
- [ ] Message grouping (same sender within 5 min)
- [ ] Auto-scroll + "new messages" pill
- [ ] Mark conversation read on open
- [ ] Responsive sidebar (collapse/hide)

## Success Criteria

- Login with valid token → redirects to /chat with session
- Invalid/disabled token → shows error
- Sidebar shows online users with green dots
- Sidebar shows conversation list sorted by last message
- Click user → opens DM
- Messages render with markdown, code blocks highlighted
- New messages appear in real-time without refresh
- Unread badge shows correct count
- Agent messages have bot badge

## Risks

| Risk | Mitigation |
|------|------------|
| Supabase Presence reconnect issues | Implement reconnection with exponential backoff. Test on slow networks. |
| Message list performance with many messages | Paginate at 50. Use `key` prop on message items. Virtualize later if needed. |
| Optimistic UI out of sync | Reconcile on server response. Show error toast on failure. |
