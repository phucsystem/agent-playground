# Phase 3: Rich Content + Groups

## Context
- SRD: FR-10 through FR-15 (Phase 2 features)
- UI Spec: S-04 (Group Chat), S-05 (Chat Info Panel)
- API Spec: File upload, attachments, conversations, members
- Prototypes: `prototypes/s04-group-chat.html`, `s05-chat-info-panel.html`

## Overview
- **Priority:** P2
- **Status:** Pending
- **Effort:** 8h
- **Depends on:** Phase 2 (core chat working)
- Add file uploads, image previews, URL detection, group conversations, info panel, agent API integration.

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/chat/file-upload.tsx` | File picker + upload progress |
| `src/components/chat/file-card.tsx` | File attachment card in message |
| `src/components/chat/image-preview.tsx` | Inline image thumbnail + lightbox |
| `src/components/chat/url-preview.tsx` | OG metadata card for URLs |
| `src/components/chat/chat-info-panel.tsx` | Slide-over info panel (S-05) |
| `src/components/chat/member-list.tsx` | Members list in info panel |
| `src/components/chat/shared-files.tsx` | Shared files list in info panel |
| `src/components/sidebar/create-group-dialog.tsx` | Modal: name + select members |
| `src/hooks/use-file-upload.ts` | Supabase Storage upload hook |
| `src/hooks/use-conversation-members.ts` | Fetch/manage members |
| `src/lib/og-metadata.ts` | Open Graph metadata fetcher |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/chat/chat-input.tsx` | Add attachment button + file upload integration |
| `src/components/chat/message-item.tsx` | Render file/image/url content types |
| `src/components/chat/chat-header.tsx` | Add member count for groups, info button |
| `src/components/sidebar/conversation-list.tsx` | Show groups with `#` prefix |
| `src/app/chat/[conversationId]/page.tsx` | Integrate info panel, detect DM vs group |

## Implementation Steps

### Step 1: File upload (FR-10)

`use-file-upload.ts`:
1. Accept file from input (images + docs)
2. Validate: max 10MB, allowed MIME types
3. Upload to Supabase Storage: `attachments/{conversation_id}/{message_id}/{filename}`
4. Return public URL + metadata
5. Show upload progress bar

`chat-input.tsx` modifications:
1. Add attachment button (paperclip icon) left of textarea
2. Click → opens native file picker
3. On file select → upload, then send message with content_type `file` or `image`
4. Show upload progress inline

### Step 2: Image preview (FR-11)

`image-preview.tsx`:
1. Render inline thumbnail (max 300px wide, aspect ratio preserved)
2. Click → lightbox overlay with full-size image
3. Lightbox: close on click outside, ESC key, or X button
4. Use `--color-overlay` for lightbox backdrop

### Step 3: File card (FR-10)

`file-card.tsx`:
1. Card with file icon (lucide) + file name + file size
2. Click → download (open in new tab)
3. File icon based on MIME type (pdf, text, csv)

### Step 4: URL detection + preview (FR-12)

`message-item.tsx`:
1. Detect URLs in text content (regex)
2. Auto-linkify URLs
3. For first URL: show OG preview card below message

`url-preview.tsx`:
1. Card with OG image, title, description, favicon
2. Click → open URL in new tab

`og-metadata.ts`:
1. Server-side: fetch OG metadata for URL (Next.js API route or during message insert)
2. Store in message `metadata` field
3. Fallback: just show clickable link if no OG data

### Step 5: Group conversations (FR-13)

`create-group-dialog.tsx`:
1. Dialog: group name input + multi-select member list
2. Members: all active users (from presence or users list)
3. On create:
   a. `POST /rest/v1/conversations` with type='group'
   b. `POST /rest/v1/conversation_members` batch (creator as admin + selected members)
   c. Navigate to new group conversation

`conversation-list.tsx` modifications:
1. Groups section with `#` prefix + group name
2. Same sort (last message time) and unread badge

`chat-header.tsx` for groups:
1. Show `# group-name` + `👥 N members` badge
2. Click member count → opens info panel

### Step 6: Chat Info Panel (S-05)

`chat-info-panel.tsx`:
1. Slide-over from right (320px), overlays chat area
2. Toggle via info button in chat header
3. Animation: translateX(100%) → translateX(0)

Sections:
- **Members** (`member-list.tsx`): avatar, name, online dot, role badge. For groups only.
- **Shared Files** (`shared-files.tsx`): recent files in conversation. File icon + name + date. Max 10 + "View all".
- **Settings**: Leave group button (for groups). Nothing for DMs.

### Step 7: Manage group members (FR-13)

`use-conversation-members.ts`:
1. Fetch members: `GET /rest/v1/conversation_members?conversation_id=eq.{id}` with user join
2. Add member (admin only): `POST /rest/v1/conversation_members`
3. Remove member (admin only): `DELETE /rest/v1/conversation_members`
4. Leave group (self): `DELETE` own membership → redirect to /chat

### Step 8: Agent API integration (FR-14)

No frontend work needed. Agents use same REST API:
1. Agent exchanges token → gets JWT (same Edge Function)
2. Agent sends messages: `POST /rest/v1/messages`
3. Agent sends files: upload to Storage + insert message with metadata
4. Agent receives: poll messages endpoint or subscribe via Supabase Realtime SDK

Document agent integration in `docs/AGENT_GUIDE.md`:
- Auth flow
- Send message examples (curl + JS)
- Send file examples
- Receive messages (polling + realtime)

### Step 9: Admin user toggle (FR-15)

No UI — admin toggles `is_active` directly in Supabase dashboard.
Auth middleware checks `is_active` on each request. If false → redirect to login with "Account disabled" message.

## Todo List

- [ ] File upload hook + Storage integration
- [ ] Attachment button in chat input
- [ ] Upload progress indicator
- [ ] Image preview (inline thumbnail + lightbox)
- [ ] File card component (icon + name + size)
- [ ] URL detection in messages (auto-linkify)
- [ ] OG metadata preview cards
- [ ] Create group dialog (name + member select)
- [ ] Group conversation list in sidebar
- [ ] Group chat header (name, member count)
- [ ] Chat info panel (slide-over)
- [ ] Member list in info panel
- [ ] Shared files list in info panel
- [ ] Leave group functionality
- [ ] Agent integration guide doc
- [ ] Admin user disable via middleware check

## Success Criteria

- Upload image → shows inline thumbnail, click → lightbox
- Upload PDF → shows file card, click → downloads
- URLs auto-linkified and show OG preview
- Create group → appears in sidebar, all members can chat
- Info panel shows members with presence + shared files
- Leave group removes user and redirects
- Agent can send message via curl (documented)

## Risks

| Risk | Mitigation |
|------|------------|
| OG metadata fetch slow/fails | Fetch async, show link immediately. Preview appears when ready. Cache metadata. |
| File upload failures | Retry logic. Show error toast. Don't send message until upload confirms. |
| Group member limit | No hard limit for MVP. Supabase handles it. |
