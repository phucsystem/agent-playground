# Basic Design (UI Specification)

## 1. Design System

### Reference Source
- Style: Nuxt AI Chat template ([chat-template.nuxt.dev](https://chat-template.nuxt.dev))
- Color System: [phucsystem/mobile-app-design-systems](https://github.com/phucsystem/mobile-app-design-systems) (spacing, radius, typography, sizing)
- Extracted: 2026-03-16

### Primary Scale (Blue)

| Token | Value | Usage |
|-------|-------|-------|
| `--primary-50` | `#eff6ff` | Subtle tint backgrounds |
| `--primary-100` | `#dbeafe` | New chat button bg, selected state |
| `--primary-200` | `#bedbff` | Light accent |
| `--primary-300` | `#8ec5ff` | Hover accent |
| `--primary-400` | `#50a2ff` | Links hover |
| `--primary-500` | `#2b7fff` | Primary actions, links, active chat item text |
| `--primary-600` | `#155dfc` | Primary buttons, strong accent |
| `--primary-700` | `#1447e6` | Primary pressed |
| `--primary-800` | `#193cb8` | Dark accent |
| `--primary-900` | `#22378e` | Deepest accent |
| `--primary-950` | `#162556` | Near-black accent |

### Neutral Scale (Zinc)

| Token | Value | Usage |
|-------|-------|-------|
| `--neutral-50` | `#f9fafb` | Code block bg, muted bg |
| `--neutral-100` | `#f4f4f5` | User message bubble, elevated bg, input bg |
| `--neutral-200` | `#e4e4e7` | Borders, dividers |
| `--neutral-300` | `#d4d4d8` | Stronger borders |
| `--neutral-400` | `#9f9fa9` | Dimmed text, placeholder |
| `--neutral-500` | `#71717b` | Muted text, timestamps |
| `--neutral-600` | `#52525c` | Toned text, secondary |
| `--neutral-700` | `#3f3f47` | Primary text |
| `--neutral-800` | `#27272a` | Strong text, headings |
| `--neutral-900` | `#18181b` | Send button bg, inverted bg |
| `--neutral-950` | `#0a0a0c` | Deepest dark |

### Semantic Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--color-success` | `#00c950` | Online indicator |
| `--color-warning` | `#f0b100` | Idle/away status |
| `--color-error` | `#fb2c36` | Errors, destructive actions, unread badge |
| `--color-info` | `#2b7fff` | Agent badge (same as primary-500) |

### Theme Tokens (Light Mode)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-background` | `#FFFFFF` | Main content background |
| `--color-background-soft` | `#f9fafb` | Code block bg, subtle areas (--neutral-50) |
| `--color-background-muted` | `#f4f4f5` | User bubble, input bg, elevated (--neutral-100) |
| `--color-text` | `#3f3f47` | Primary text (--neutral-700) |
| `--color-text-highlighted` | `#18181b` | Headings, strong text (--neutral-900) |
| `--color-text-muted` | `#71717b` | Timestamps, secondary (--neutral-500) |
| `--color-text-dimmed` | `#9f9fa9` | Placeholder, dimmed (--neutral-400) |
| `--color-text-inverted` | `#FFFFFF` | Text on dark bg (send button) |
| `--color-border` | `#e4e4e7` | Dividers, subtle borders (--neutral-200) |
| `--color-shadow` | `rgba(0,0,0,0.08)` | Shadow color base |
| `--color-card-bg` | `#FFFFFF` | Card/panel backgrounds |
| `--color-overlay` | `rgba(0,0,0,0.5)` | Modal/lightbox overlay |

### Sidebar Colors (Light sidebar — Nuxt Chat style)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-sidebar` | `#FFFFFF` | Sidebar background (same as content bg) |
| `--color-sidebar-hover` | `#f4f4f5` | Sidebar item hover (--neutral-100) |
| `--color-sidebar-active` | `#f4f4f5` | Active conversation bg (--neutral-100) |
| `--color-sidebar-text` | `#3f3f47` | Sidebar text primary (--neutral-700) |
| `--color-sidebar-text-muted` | `#71717b` | Sidebar text secondary (--neutral-500) |
| `--color-sidebar-accent` | `#2b7fff` | Active chat item text, "New chat" text (--primary-500) |
| `--color-sidebar-new-chat-bg` | `#dbeafe` | "New chat" button bg (--primary-100) |
| `--color-sidebar-border` | `#e4e4e7` | Sidebar right border (--neutral-200) |
| `--color-rail-bg` | `#27272a` | Workspace rail background (--neutral-800) |
| `--color-rail-active-ring` | `#8ec5ff` | Active workspace ring (--primary-300) |

### Typography

| Token | Value |
|-------|-------|
| `--font-heading` | `-apple-system, 'SF Pro Display', 'Roboto', system-ui, sans-serif` |
| `--font-body` | `-apple-system, 'SF Pro Text', 'Roboto', system-ui, sans-serif` |
| `--font-mono` | `'SF Mono', 'Roboto Mono', 'JetBrains Mono', monospace` |
| `--text-h1` | `28px / 34px / 700` |
| `--text-h2` | `24px / 30px / 600` |
| `--text-h3` | `20px / 26px / 600` |
| `--text-h4` | `18px / 24px / 500` |
| `--text-body1` | `16px / 24px / 400` |
| `--text-body2` | `14px / 20px / 400` |
| `--text-caption` | `12px / 16px / 400` |
| `--text-button` | `16px / 20px / 500` |
| `--text-overline` | `11px / 16px / 600` |

### Spacing Scale

| Token | Value |
|-------|-------|
| `--space-0` | `0px` |
| `--space-xs` | `4px` |
| `--space-sm` | `8px` |
| `--space-md` | `16px` |
| `--space-lg` | `24px` |
| `--space-xl` | `32px` |
| `--space-2xl` | `48px` |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-xs` | `4px` | Badges, small chips |
| `--radius-sm` | `8px` | Buttons, inputs |
| `--radius-md` | `12px` | Cards, panels |
| `--radius-lg` | `16px` | Sheets, modals |
| `--radius-xl` | `24px` | Large avatars |
| `--radius-full` | `9999px` | Pills, circular avatars |

### Shadows

| Token | Value |
|-------|-------|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.12)` |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.12)` |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.12)` |
| `--shadow-xl` | `0 16px 48px rgba(0,0,0,0.12)` |

### Size Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--icon-sm` | `16px` | Inline icons |
| `--icon-md` | `24px` | Action icons |
| `--icon-lg` | `32px` | Feature icons |
| `--touch-target` | `44px` | Minimum tap area |
| `--avatar-sm` | `32px` | Compact message avatar |
| `--avatar-md` | `48px` | Sidebar/profile avatar |
| `--avatar-lg` | `80px` | Profile header |
| `--header-height` | `56px` | Chat header, app bar |

### CJX Stage Variables

| Stage | Screens | Goal |
|-------|---------|------|
| **Onboarding** | S-01 Login | Frictionless token entry, immediate access |
| **Usage** | S-02 Sidebar, S-03 DM, S-04 Group | Core value — chat with agents and testers |
| **Retention** | S-03, S-04 (message history) | Persistent history brings users back |
| **Discovery** | S-02 (presence list), S-05 (info panel) | Find new agents/testers to interact with |
| **Operations** | S-06 (admin), S-08 (webhook logs) | Monitor agent health, debug webhook delivery |
| **Navigation** | S-09 Workspace Rail | Quick workspace switching, context scoping |
| **Awareness** | S-10 Changelog | Stay informed of new features and improvements |

### Component Patterns

**User Message (Self):** Right-aligned, rounded bubble with `--neutral-100` bg, `--neutral-700` text, `--radius-md`. No avatar shown.

**Other Human Message:** Left-aligned with avatar, sender name (`--neutral-800`, bold), content below. Subtle hover state (`--neutral-50`).

**Agent Message:** Left-aligned, no bubble (flat text on white bg). Content rendered as markdown. Avatar shown with bot badge.

**Message Reactions:** Heart button ❤️ visible on hover (right of message). Click to add/toggle reaction. Show count badge if >0 reactions. Realtime sync across users.

**Code Block:** Light background (`--neutral-50`), syntax highlighted, copy button top-right. Colored bottom-border accent (blue). `--font-mono` with `--text-body2`.

**Input Bar:** Rounded container with `--neutral-100` bg, no visible border. Attachment icon (left), auto-grow textarea (center), send button (right, dark `--neutral-900` bg, white icon, rounded `--radius-sm`).

**Avatar:** `--avatar-sm` (32px) in messages, `--avatar-md` (48px) in sidebar. Circle with initials fallback. Agent avatars have bot badge.

**Presence Dot:** 10px circle, bottom-right of avatar. `--color-success` = online, `--neutral-400` = offline. Hidden for mock users (non-admin only).

**Sidebar Section:** Collapsible header with arrow icon. Click to expand/collapse. Counts badge shows number of items.

**New Chat Button:** Full-width, `--primary-100` bg, `--primary-500` text, rounded `--radius-sm`.

**Workspace Avatar:** Color-coded circle with first letter of workspace name. Custom image if set. Sizes: sm (32px), md (40px), lg (48px).

**Collapsible Section:** Expandable sidebar section with chevron icon, title, count badge. Click header to toggle. 11px uppercase tracking-wide label.

**Flip Loader:** 3D animated loading indicator with rotating square. Sizes: sm, md, lg. Optional text label below.

**Presence Toast:** Sonner toast notification when user comes online/offline. Shows avatar + "User is now online/offline".

**Agent Health Dot:** Colored dot on agent avatar. Green = healthy, grey = unhealthy/unknown. Only shown for agents with health_check_url configured.

**Notification Bell:** Toggle button in user profile header. Blue = enabled, grey = disabled. Click requests browser notification permission if needed.

**Pin Button:** Small pin icon on conversation items. Visible on hover, filled when pinned. Click to toggle pin state. Pinned conversations appear at top of section.

---

## 2. Screen Flow

```
[S-01: Login]
    │
    ▼ (valid token, first login)
[S-07: Setup Page]
    │ (set avatar + nickname)
    ▼
[S-02: Main Layout]
    ├── [S-09: Workspace Rail (60px)] | [Sidebar (260px)] | [Chat Area]
    │   (desktop layout — rail always visible left of sidebar)
    │
    ├── [S-09: Workspace Rail] (left, 60px dark rail)
    │   ├── Workspace avatars (stacked vertically)
    │   └── Create workspace button (admin only)
    │
    ├── Sidebar (fixed 260px, collapsible sections)
    │   ├── User profile section (top)
    │   ├── Online users (collapsible, filtered by mock flag)
    │   ├── DM conversations (collapsible)
    │   ├── Group conversations (collapsible)
    │   ├── New conversation button
    │   └── Version badge (links to S-10 Changelog)
    │
    ├── Chat Area (right, flexible)
    │   ├── [S-03: DM Chat] ← click DM conversation
    │   └── [S-04: Group Chat] ← click group conversation
    │
    ├── [S-05: Chat Info Panel] ← click conversation header info icon
    │   (slide-over from right, 320px)
    │
    ├── [S-06: Admin Page] ← (admin only, from sidebar menu)
    │   User list, token generation, manage users
    │   ├── Agent webhook config (inline when creating agent token)
    │   └── [S-08: Webhook Logs] ← click "View Logs" on agent row
    │
    └── [S-10: Changelog] ← click version badge in sidebar footer
        (GitHub release notes, read-only)
```

**Desktop layout:** `[S-09: Workspace Rail (60px)] | [S-02: Sidebar (260px)] | [Chat Area]`

**Mobile layout:** Sidebar slides over full-width with workspace strip at top (horizontal 32px avatars, scrollable).

**Navigation Rules:**
- Login → Main Layout (auto-redirect if session valid)
- Click workspace in rail → switch workspace context, sidebar updates
- Sidebar conversation click → loads chat in right panel
- Click user in presence list → opens/creates DM
- Info icon in chat header → toggles info panel slide-over
- Logout → back to Login

---

## 3. Screen Specifications

### S-01: Login

**Phase:** P1
**Layout:** Centered card on neutral background
**CJX Stage:** Onboarding

```
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│         ┌───────────────────────┐           │
│         │   🤖 Agent Playground │           │
│         │                       │           │
│         │  Enter your token     │           │
│         │  ┌─────────────────┐  │           │
│         │  │ paste-token-here│  │           │
│         │  └─────────────────┘  │           │
│         │                       │           │
│         │  [ Sign In          ] │           │
│         │                       │           │
│         │  Token provided by    │           │
│         │  your admin.          │           │
│         └───────────────────────┘           │
│                                             │
└─────────────────────────────────────────────┘
```

**Elements:**
| Element | Type | Details |
|---------|------|---------|
| App title | Text (h1) | "Agent Playground" with icon |
| Token input | Input (text, password-masked) | Placeholder: "Paste your access token". Auto-focus on load. |
| Sign In button | Button (primary) | Full-width. Disabled until token entered. Loading spinner on submit. |
| Helper text | Caption | "Token provided by your admin." |
| Error state | Toast/inline | "Invalid or expired token" / "Account disabled" |

**Auto-Login:**
- On page load, checks localStorage for cached token (`agent_playground_token`)
- If found, shows spinner and auto-attempts login
- If valid, redirects to S-02 or S-07 (based on setup status)
- If invalid, clears cache and shows token entry form

**Transitions:**
- Valid token → cache to localStorage → S-02 Main Layout or S-07 Setup (redirect with session cookie)
- Invalid token → inline error message, input border turns `--color-danger`, offer manual entry
- Disabled account → "Your account has been disabled. Contact admin."
- Logout clears localStorage token from both auth.ts and sidebar

---

### S-02: Main Layout (Sidebar)

**Phase:** P1
**Layout:** Workspace Rail (60px) + fixed sidebar (260px) + flexible chat area
**CJX Stage:** Usage + Discovery

```
┌────┬──────────┬─────────────────────────────────────┐
│RAIL│ SIDEBAR  │                                     │
│60px│ 260px    │                                     │
│    │          │                                     │
│ ⬤  │ ┌──────┐ │         Select a conversation       │
│ W1 │ │ Phuc │ │         to start chatting            │
│    │ │●online│ │                                     │
│ ⬤  │ └──────┘ │                                     │
│ W2 │          │                                     │
│    │ ONLINE(3)│                                     │
│ ┄┄ │ ● Alice  │                                     │
│ +  │ 🤖 GPT-4 │                                     │
│    │ 🤖 Claude│                                     │
│    │          │                                     │
│    │ DMs      │                                     │
│    │ Alice    │                                     │
│    │ GPT-4 🤖 │                                     │
│    │          │                                     │
│    │ GROUPS   │                                     │
│    │ # test-a │                                     │
│    │ # agents │                                     │
│    │          │                                     │
│    │ [+ New]  │                                     │
└────┴──────────┴─────────────────────────────────────┘
```

**Sidebar Sections:**

| Section | Details |
|---------|---------|
| User profile | Current user avatar + name + online dot. Click → logout option. |
| Online users | Supabase Presence. Show avatar + name + green dot. Click → open/create DM. Agents have bot badge. |
| DM conversations | Sorted by last message time. Show other participant name + last message preview (truncated 40 chars) + unread badge (count). |
| Group conversations | Sorted by last message time. Show `#` prefix + group name + last message preview + unread badge. |
| New conversation | Button at bottom. Opens modal to create group (name + select members). |

**Empty State:** Center text "Select a conversation to start chatting" with subtle illustration.

**Responsive:**
- Desktop (≥1024px): Workspace Rail (60px) + Sidebar (260px) + Chat Area
- Mobile (<768px): Sidebar slides over full-width with workspace strip at top; hamburger menu to toggle.

---

### S-03: DM Chat

**Phase:** P1 (text), P2 (files/URLs)
**Layout:** Chat header (56px) + scrollable message list + fixed input bar (56px)
**CJX Stage:** Usage

```
┌─────────────────────────────────────────┐
│ 🤖 Claude-Agent        ● Online    ℹ️   │ ← Header
├─────────────────────────────────────────┤
│                                         │
│  🤖 Claude-Agent          10:32 AM      │
│  Here's the analysis you requested:     │
│  ┌─────────────────────────────────┐    │
│  │ ```python                       │    │
│  │ def analyze(data):              │    │
│  │     return data.describe()      │    │
│  │ ```                        📋   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Phuc                      10:33 AM     │
│  Looks good! Can you also check the     │
│  edge cases for null values?            │
│                                         │
│  🤖 Claude-Agent          10:33 AM      │
│                                         │
│  Agent is thinking...                   │
│  ⬤ ⬤ ⬤ (bouncing dots)                   │
│                                         │
├─────────────────────────────────────────┤
│ 📎 │ Type a message...          │ Send │ ← Input
└─────────────────────────────────────────┘
```

**Header Elements:**
| Element | Details |
|---------|---------|
| Avatar + name | Other participant. Bot badge for agents. |
| Status | Online dot + "Online" / "Offline" / "Last seen 2h ago" |
| Info button | Opens S-05 Chat Info Panel (slide-over) |

**Message List:**
| Element | Details |
|---------|---------|
| Message group | Messages from same sender within 5 min grouped (no repeated avatar/name). |
| Avatar | 36px, left-aligned. Bot badge for agents. |
| Sender name | Bold, `--text-body` weight 700. Agent names in `--color-agent-badge`. |
| Timestamp | Right of sender name, `--text-caption`, `--color-text-muted`. Relative ("2m ago") within 1h, then "10:32 AM". |
| Content | `--text-body`. Markdown rendered via react-markdown. |
| Code block | Dark bg, syntax highlight (rehype-highlight), copy button. |
| Image (P2) | Inline thumbnail (max 300px wide). Click → lightbox. |
| File (P2) | Card with file icon + name + size. Click → download. |
| URL (P2) | Clickable link. Optional OG preview card below (title + description + favicon). |
| Hover toolbar | On message hover: emoji reaction picker, more options (⋮). |

**Input Bar:**
| Element | Details |
|---------|---------|
| Attachment button | `📎` icon left. Opens file picker (images + docs). Shows upload progress. |
| Text input | Auto-growing textarea. Placeholder "Type a message...". Enter = send, Shift+Enter = newline. |
| Send button | Right side. Disabled when empty. `--color-primary` background. |

**Agent Thinking Indicator (DM with agents only):**
- Shown when user sends message to agent (after send button clicked)
- Display: "Agent is thinking..." with animated bouncing dots below last message
- Clears when agent message arrives OR after 30s timeout (matches webhook timeout)
- Client-side heuristic: watches messages array in DM conversation

**Scroll Behavior:**
- Auto-scroll to bottom on new message (if already at bottom)
- "New messages" pill when scrolled up and new messages arrive
- Infinite scroll up for history (load 50 messages per page)

---

### S-04: Group Chat

**Phase:** P2
**Layout:** Same as S-03 + member list in header
**CJX Stage:** Usage

```
┌─────────────────────────────────────────┐
│ # test-agents       👥 5 members    ℹ️   │ ← Header
├─────────────────────────────────────────┤
│                                         │
│  Alice                     10:30 AM     │
│  Hey everyone, let's test the new       │
│  agent capabilities.                    │
│                                         │
│  🤖 GPT-4                  10:31 AM     │
│  Ready to assist! What would you like   │
│  me to help with?                       │
│                                         │
│  🤖 Claude                 10:31 AM     │
│  I'm here too. Fire away.              │
│                                         │
│  Bob                       10:32 AM     │
│  @GPT-4 can you summarize this doc?     │
│  📄 requirements.pdf (2.4 MB)           │
│                                         │
├─────────────────────────────────────────┤
│ 📎 │ Message #test-agents...    │ Send │
└─────────────────────────────────────────┘
```

**Differences from S-03:**
| Element | Details |
|---------|---------|
| Header | Shows `#` + group name, member count badge, info button |
| Messages | Multiple senders — avatar + name always shown for each message (no grouping across senders) |
| Input placeholder | "Message #group-name..." |
| Member indicator | `👥 N members` clickable → opens S-05 |
| @Mention routing | Only @mentioned agents receive webhooks. No "typing" indicator shown for un-mentioned agents. If no agents @mentioned in group → system response "No agents mentioned" |

---

### S-05: Chat Info Panel

**Phase:** P2
**Layout:** Slide-over panel from right (320px width), overlays chat area
**CJX Stage:** Discovery

```
                          ┌──────────────┐
                          │ ✕  Chat Info  │
                          ├──────────────┤
                          │              │
                          │ MEMBERS (5)  │
                          │ ● Alice      │
                          │ ● Bob        │
                          │ 🤖 GPT-4 ●   │
                          │ 🤖 Claude ●   │
                          │ ○ Charlie    │
                          │              │
                          │ SHARED FILES │
                          │ 📄 reqs.pdf  │
                          │ 🖼 chart.png  │
                          │ 📄 notes.md  │
                          │              │
                          │ SETTINGS     │
                          │ [Leave group]│
                          └──────────────┘
```

**Sections:**
| Section | Details |
|---------|---------|
| Header | "Chat Info" title + close (✕) button |
| Members | List with avatar, name, online dot, role badge (admin). For DMs: just the other participant. |
| Shared Files | Recent files shared in conversation. Click → download. Show file icon + name + date. Max 10, "View all" link. |
| Settings | Leave group (for groups). For DMs: no settings. |

---

### S-06: Admin Page

**Phase:** P4
**Layout:** Full page (no sidebar), centered panel with user table
**Access:** `/admin` (admin role only)
**CJX Stage:** Retention (admin tools)

```
┌─────────────────────────────────────────────────────────┐
│ Agent Playground — Admin                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Users (5)                                               │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Name      │ Email           │ Role    │ Status   │ │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ Phuc      │ admin@example   │ admin   │ Active ✓ │ │ │
│ │ Alice     │ alice@example   │ user    │ Active ✓ │ │ │
│ │ Bob       │ bob@example     │ user    │ Disabled │ │ │
│ │ Claude    │ claude@agents   │ agent   │ Active ✓ │ │ │
│ │ Mock Bot  │ mock@example    │ agent   │ Mock     │ │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
│ Actions (row):                                          │
│ │ Copy Token │ Enable/Disable │ Delete │               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Elements:**
| Element | Type | Details |
|---------|------|---------|
| User table | Table | Sortable by name, email, role. Inline actions. |
| Name | Text | Display name. Click → view/edit profile. |
| Email | Text | User email (read-only). |
| Role | Badge | admin/user/agent labels. Color-coded. |
| Status | Badge | Active (green), Disabled (grey), Mock (blue). |
| Actions | Buttons | Copy token, Enable/Disable toggle, Delete (destructive red). |
| Token display | Modal | Show on "Copy Token" click. Copyable to clipboard. |

**Generate Invite Token:**
- Button: "Generate Token" (in separate panel or modal)
- Optional checkbox: "Is agent?" (defaults to user)
- On click: system generates 64-char token, auto-generates email (`invite-{shortId}@placeholder.local`) and name ("New User")
- User customizes email/name on first login via /setup page
- Modal shows generated token with copy button

**Agent Webhook Config (Phase 5 — shown when "Is agent?" is checked):**

```
┌───────────────────────────────────────────┐
│ Generate Token                            │
│                                           │
│ ☑ Is agent?                               │
│                                           │
│ Webhook URL *                             │
│ ┌───────────────────────────────────────┐ │
│ │ https://my-agent.example.com/webhook  │ │
│ └───────────────────────────────────────┘ │
│                                           │
│ Webhook Secret (optional)                 │
│ ┌───────────────────────────────────────┐ │
│ │ whsec_••••••••••••••••               │ │
│ └───────────────────────────────────────┘ │
│ ℹ Used for HMAC-SHA256 signature          │
│                                           │
│ [Cancel]              [Generate Token →]  │
└───────────────────────────────────────────┘
```

| Element | Type | Details |
|---------|------|---------|
| Webhook URL | Input (url) | Required when "Is agent?" checked. Placeholder: "https://your-agent.com/webhook". Validated as URL. |
| Webhook Secret | Input (password) | Optional. If set, all webhook payloads include `X-Webhook-Signature` HMAC-SHA256 header. Show/hide toggle. |
| Info text | Caption | "Used for HMAC-SHA256 signature verification" |

**Agent Row Actions (Phase 5 — additional for agent users):**

| Action | Details |
|--------|---------|
| Edit Webhook | Opens inline editor for webhook URL + secret. Save updates `agent_configs`. |
| Toggle Webhook | Enable/disable webhook delivery without removing config. Visual indicator: green dot = active, grey = paused. |
| View Logs | Opens S-08 Webhook Logs filtered to this agent. |

**GoClaw Integration Mode (Phase 7 — shown when "Is agent?" is checked):**

```
┌───────────────────────────────────────────┐
│ Generate Token                            │
│                                           │
│ ☑ Is agent?                               │
│                                           │
│ ◯ Custom Webhook    ◉ GoClaw Agent       │
│                                           │
│ [GoClaw badge] — Auto-configured         │
│ Webhook URL: https://goclaw/api/bridge   │
│ Health Check: https://goclaw/health      │
│ Webhook Secret (required) *               │
│ ┌───────────────────────────────────────┐ │
│ │ (auto-filled from GoClaw config)      │ │
│ └───────────────────────────────────────┘ │
│                                           │
│ GoClaw Agent Key *                        │
│ ┌───────────────────────────────────────┐ │
│ │ uuid-of-goclaw-agent-config          │ │
│ └───────────────────────────────────────┘ │
│                                           │
│ Test Connection: [✓ Healthy] (45ms)      │
│                                           │
│ [Cancel]              [Generate Token →]  │
└───────────────────────────────────────────┘
```

**GoClaw Mode Features:**
- Radio toggle: "Custom Webhook" (default) vs "GoClaw Agent"
- When GoClaw selected:
  - Webhook URL field becomes read-only (set to `/api/goclaw/bridge`)
  - Health Check URL becomes read-only (set to NEXT_PUBLIC_GOCLAW_URL)
  - "GoClaw" badge appears next to agent name
  - Webhook Secret field required (auto-filled from GOCLAW_GATEWAY_TOKEN config, user can override)
  - New "GoClaw Agent Key" field required (UUID of agent in GoClaw server)
  - Test Connection button calls GET `/api/goclaw/test` (shows latency + status)
- Stores config: `agent_configs { webhook_url: ..., webhook_secret: ..., metadata: { goclaw_agent_key: "..." } }`

**Interactions:**
- Toggle Enable/Disable: immediate state update, reflected in sidebar presence
- Delete: confirm dialog, remove user from all conversations
- Copy Token: show modal with token, auto-copy button
- No pagination needed (< 100 users expected)

---

### S-07: Setup Page

**Phase:** P4
**Layout:** Centered card, two-step flow
**Trigger:** First login (auto-redirect from /login)
**CJX Stage:** Onboarding

```
┌─────────────────────────────────────────────────────┐
│           Complete Your Profile                     │
│                                                     │
│  Step 1: Choose Avatar                             │
│  ┌─────────────────────────────────────────────┐   │
│  │ 🧑 Adventurer │ 🤖 Bottts │ 😺 Lorelei │    │   │
│  │ 🎨 Avataaars │ 🎭 Miniavs │ 👻 Personas │   │   │
│  │ 📖 Pixel Art  │ 🎪 Open     │ 🏝️ Rings   │   │   │
│  │ 📐 Shapes    │ 🌙 Thumbs   │ 👶 Vibrant  │   │   │
│  │  (12 styles from DiceBear)                 │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Selected: Adventurer                              │
│  [Preview avatar here]                             │
│                                                     │
│  Step 2: Enter Nickname                            │
│  ┌──────────────────────────────┐                  │
│  │ Phuc                         │                  │
│  └──────────────────────────────┘                  │
│                                                     │
│  [← Back]         [Complete Setup →]               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Elements:**
| Element | Type | Details |
|---------|------|---------|
| Title | Heading | "Complete Your Profile" |
| Avatar picker | Grid | 12 DiceBear style buttons. Click to select. Selected has blue border. |
| Avatar preview | Image | Live preview of selected style + nickname. |
| Nickname input | Input | Max 32 chars. Placeholder "Your nickname". |
| Back button | Button | Return to previous step. |
| Complete button | Button | Primary blue. Saves profile + redirects to /chat. |

**Interactions:**
- Select avatar style → preview updates in real-time
- Type nickname → preview updates
- Complete → POST to update user record, redirect to /chat/

---

### S-08: Webhook Logs

**Phase:** P5
**Layout:** Slide-over panel from S-06 Admin Page, or standalone page at `/admin/webhooks`
**Access:** Admin only
**CJX Stage:** Retention (admin debugging tools)

```
┌─────────────────────────────────────────────────────────┐
│ Webhook Delivery Logs                        [× Close]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Filter: [All agents ▼] [All statuses ▼] [Last 24h ▼]  │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Time        │ Agent    │ Message     │ Status  │ ⏱  │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ 10:33:12 AM │ Claude   │ "Help me.." │ ✓ 200  │ 1s │ │
│ │ 10:32:45 AM │ GPT-4    │ "Summarize" │ ✓ 200  │ 2s │ │
│ │ 10:31:00 AM │ Claude   │ "Hey there" │ ✗ 500  │ 5s │ │
│ │             │          │ Retry 2/3   │ ✓ 200  │ 1s │ │
│ │ 10:30:15 AM │ GPT-4    │ "Test msg"  │ ✗ timeout│   │ │
│ │             │          │ Retry 3/3   │ ✗ timeout│   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Showing 50 of 234 entries        [Load more]           │
└─────────────────────────────────────────────────────────┘
```

**Elements:**

| Element | Type | Details |
|---------|------|---------|
| Filter: Agent | Dropdown | Filter by specific agent or "All agents" |
| Filter: Status | Dropdown | "All", "Delivered", "Failed" |
| Filter: Time range | Dropdown | "Last 1h", "Last 24h", "Last 7d" |
| Log table | Table | Columns: timestamp, agent name, message preview (truncated 30 chars), HTTP status, latency |
| Status badge | Badge | Green `✓ 200` for success, Red `✗ 500` / `✗ timeout` for failure |
| Retry rows | Sub-row | Indented under parent, shows retry attempt number and result |
| Expand row | Click | Shows full message content, webhook URL called, request/response headers, error details |
| Load more | Button | Pagination (50 per page) |

**Interactions:**
- Click row → expands to show full webhook payload + response
- Retry badge shows `Retry N/3` with color: yellow for pending, green for success, red for exhausted
- Auto-refresh toggle (poll every 10s when enabled)

---

### S-09: Workspace Rail

**Phase:** P6
**Layout:** Vertical rail (60px wide), dark bg (`--neutral-800`), left of sidebar
**CJX Stage:** Navigation

```
┌────┬──────────┬──────────────────────────┐
│RAIL│ SIDEBAR  │                          │
│60px│ 260px    │                          │
│    │          │                          │
│ ⬤  │ ┌──────┐│    Chat Area             │
│ W1 │ │ Phuc ││                          │
│    │ │●online││                          │
│ ⬤  │ └──────┘│                          │
│ W2 │          │                          │
│    │ DMs      │                          │
│ ┄┄ │ Alice   │                          │
│ +  │ GPT-4   │                          │
│    │          │                          │
│    │ GROUPS   │                          │
│    │ # test-a │                          │
│    │          │                          │
└────┴──────────┴──────────────────────────┘
```

**Elements:**
| Element | Details |
|---------|---------|
| Workspace avatar | 40px circle, color-coded letter or custom image. Active: ring-2 ring-primary-300 with ring-offset. Inactive: opacity-70, hover:opacity-100. |
| Active indicator | 4px white bar left edge, vertically centered |
| Unread badge | Red circle top-right of avatar, shows count (max "99+") |
| Create button | "+" button (admin only) below separator. Opens create workspace dialog. |
| Tooltip | Fixed-position tooltip on hover showing workspace name |

**Mobile:** Horizontal strip at top of sidebar with smaller avatars (32px), scrollable.

**Interactions:**
- Click workspace → switch context, sidebar shows workspace conversations
- Hover → tooltip with workspace name
- Active workspace has white indicator bar + ring highlight

---

### S-10: Changelog

**Phase:** P7
**Layout:** Full page (no sidebar), centered container with markdown-rendered release notes
**Access:** `/changelog` (all users)
**CJX Stage:** Awareness

```
┌─────────────────────────────────────────────────────────────┐
│ 🤖 Agent Playground — Changelog                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ # v1.4.1                                   2026-03-19       │
│                                                             │
│ ## Fixed                                                    │
│ - Message soft-delete functionality with audit trail        │
│ - Edit message timestamp tracking                           │
│ - Admin audit log visibility                                │
│                                                             │
│ ---                                                         │
│                                                             │
│ # v1.4.0                                   2026-03-17       │
│ ## Added                                                    │
│ - React Query v5 with localStorage persister                │
│ - Sidebar realtime sync improvements                        │
│ - Unread message marking on navigation                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Elements:**
| Element | Type | Details |
|---------|------|---------|
| Title | Heading | "Agent Playground — Changelog" |
| Release cards | Markdown | GitHub release notes fetched at build time (ISR revalidation for updates) |
| Version | Text | Release version tag (e.g., "v1.4.1") |
| Date | Text | Release publish date |
| Content | Markdown | Full release body (features, fixes, breaking changes) rendered with react-markdown |
| Scroll | Behavior | Infinite scroll or load more for historical releases |

**Technical Details:**
- Build-time static fetch from GitHub releases API
- ISR revalidation every 24h to pick up new releases
- Markdown rendering via react-markdown
- Responsive layout (mobile-friendly)
- Accessible via version badge in sidebar footer (links to `/changelog`)

**Interactions:**
- Click version badge in sidebar → navigate to changelog
- Read release notes
- Navigate back to chat or other sections

---

## 4. Design Rationale

| Decision | Rationale |
|----------|-----------|
| Nuxt Chat-style minimal design | Clean, spacious, modern. White bg with zinc neutrals. Proven pattern for AI chat apps. |
| Light sidebar (white, border-separated) | Cohesive light theme. No harsh dark/light contrast. Softer visual hierarchy. Sidebar border is sufficient separator. |
| User messages: right-aligned bubble | Familiar chat pattern (iMessage/WhatsApp). Clear visual distinction between user and AI/agent without color-coding. |
| Agent messages: flat (no bubble) | Agent responses are often long (code, markdown). No bubble maximizes content width. |
| Light code blocks with accent border | Matches the Nuxt Chat pattern. Better readability than dark-on-light. Blue bottom border provides visual accent. |
| Dark send button (neutral-900) | High contrast, clear call-to-action. Matches Nuxt Chat template. Distinct from the light input area. |
| Agent bot badge (blue) | Subtle identification. Badge on avatar corner, not color-coded messages. Keeps UI clean. |
| Relative timestamps within 1h | Reduces cognitive load. "2m ago" is more useful than "10:31 AM" for recent messages. |
| Webhook config in AgentInvite flow | Decoupled design. Webhook URL defined at agent creation time, stored in separate `agent_configs` table. Core chat code has zero knowledge of webhooks. Edge Function handles all delivery logic. |
| Webhook logs as slide-over | Keeps admin in context of user table. No full-page navigation needed. Quick debugging without losing state. |

## 5. Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| `≥1024px` | Full layout: workspace rail (60px) + sidebar (260px) + chat + optional info panel (320px) |
| `768px–1023px` | Rail hidden. Sidebar collapses to 60px (icons only). Chat full width. Info panel overlays. |
| `<768px` | Rail hidden. Sidebar hidden (hamburger toggle) with workspace strip at top. Chat full width. Info panel full-screen modal. |

---

## 🚦 GATE 2: Requirements Validation

Before proceeding to `/ipa:design`:

- [ ] Stakeholders reviewed SRD.md
- [ ] Feature priorities (P1/P2/P3) confirmed
- [ ] Scope still matches /lean output (3 phases, no creep)
- [ ] Design System tokens approved (colors, typography)
- [ ] No scope creep detected

**Next:** `/ipa:design` to generate HTML prototypes
