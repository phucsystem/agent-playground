# HTML Prototypes - Agent Playground

Generated from `docs/UI_SPEC.md` on 2026-03-16.

## Screen Index

| Screen | File | CJX Stage | Phase |
|--------|------|-----------|-------|
| S-01 Login | [s01-login.html](s01-login.html) | Onboarding | P1 |
| S-02 Main Layout (Sidebar) | [s02-main-layout.html](s02-main-layout.html) | Usage + Discovery | P1 |
| S-03 DM Chat | [s03-dm-chat.html](s03-dm-chat.html) | Usage | P1 |
| S-04 Group Chat | [s04-group-chat.html](s04-group-chat.html) | Usage | P2 |
| S-05 Chat Info Panel | [s05-chat-info-panel.html](s05-chat-info-panel.html) | Discovery | P2 |
| S-06 Admin Page | [s06-admin.html](s06-admin.html) | Retention | P4 |
| S-07 Setup Page | [s07-setup.html](s07-setup.html) | Onboarding | P4 |
| S-08 Webhook Logs | [s08-webhook-logs.html](s08-webhook-logs.html) | Retention | P5 |

## FR Mapping

| FR | Description | Screen(s) |
|----|-------------|-----------|
| FR-01 | Authentication (token login) | S-01 |
| FR-02 | Navigation (sidebar, conversations) | S-02 |
| FR-03 | Presence (online users, status dots) | S-02, S-03, S-04 |
| FR-04 | Direct Messaging | S-03 |
| FR-05 | Code Blocks (syntax highlight, copy) | S-03 |
| FR-06 | Group Messaging | S-04 |
| FR-07 | File Sharing (attachments) | S-04 |
| FR-08 | Conversation Details (info panel) | S-05 |
| FR-09 | Admin Management (user table, enable/disable) | S-06 |
| FR-10 | Token Generation (invite, agent webhook config) | S-06 |
| FR-11 | Profile Setup (avatar picker, nickname) | S-07 |
| FR-12 | Webhook Monitoring (delivery logs, retries) | S-08 |

## Shared Files

| File | Purpose |
|------|---------|
| `styles.css` | Design tokens from UI_SPEC (colors, typography, spacing, layout) |
| `components.css` | Reusable component styles (messages, sidebar, avatars, inputs, admin, setup, webhooks) |
| `interactions.js` | CJX animations, info panel toggle, login form, chat input, admin modal, avatar picker, webhook row expand |

## Design System

- **Style:** Nuxt AI Chat template (clean, minimal, light theme)
- **Sidebar:** White background, border-separated, fixed 260px
- **Content:** Light background (#ffffff), max readability
- **Agents:** Bot badge on avatar, agent name in primary blue
- **Font:** System fonts (SF Pro, Roboto, system-ui)

## How to View

Open any `.html` file directly in a browser. No build step required.

## Navigation Flow

```
S-01 Login
  |
  v (valid token, first login)
S-07 Setup Page
  |
  v (profile complete)
S-02 Main Layout
  |-- Click DM --> S-03 DM Chat
  |-- Click Group --> S-04 Group Chat
  |-- Click info icon --> S-05 Chat Info Panel (slide-over)
  |-- Admin link --> S-06 Admin Page
                      |-- View Logs --> S-08 Webhook Logs
```
