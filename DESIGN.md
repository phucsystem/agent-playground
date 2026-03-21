# Design System — Agent Playground

## Product Context
- **What this is:** Chat playground where humans and AI agents collaborate via conversations and webhooks
- **Who it's for:** Developers and testers integrating AI agents
- **Space/industry:** Developer tools, AI chat interfaces
- **Project type:** Web app (Next.js 16 + React 19 + Tailwind CSS 4 + Supabase)
- **Reference:** Nuxt AI Chat template (chat-template.nuxt.dev)

## Aesthetic Direction
- **Direction:** Industrial/Utilitarian — function-first, data-aware, clean
- **Decoration level:** Minimal — typography and spacing do the work
- **Mood:** Professional but approachable. Feels like a tool you trust, not a toy.
- **Reference sites:** chat-template.nuxt.dev, WhatsApp Web, Telegram Web

## Typography
- **Display/Hero:** System fonts — `-apple-system, "SF Pro Display", system-ui, sans-serif`
- **Body:** System fonts — `-apple-system, "SF Pro Text", "Roboto", system-ui, sans-serif`
- **UI/Labels:** Same as body
- **Data/Tables:** System fonts with `font-variant-numeric: tabular-nums`
- **Code:** `"SF Mono", "Roboto Mono", "JetBrains Mono", monospace`
- **Loading:** System fonts (no external loading required)
- **Scale:**
  - H1: 28px / 34px / 700
  - H2: 24px / 30px / 600
  - H3: 20px / 26px / 600
  - H4: 18px / 24px / 500
  - Body1: 16px / 24px / 400
  - Body2: 14px / 20px / 400
  - Caption: 12px / 16px / 400
  - Button: 16px / 20px / 500
  - Overline: 11px / 16px / 600

## Color
- **Approach:** Restrained — blue accent + zinc neutrals
- **Primary:** `#2b7fff` (Primary-500) — actions, links, active states
- **Secondary:** `#155dfc` (Primary-600) — buttons, strong accents
- **Neutrals:** Zinc scale from `#f9fafb` (50) to `#0a0a0c` (950)
- **Semantic:** success `#00c950`, warning `#f0b100`, error `#fb2c36`, info `#2b7fff`
- **Dark mode:** Not implemented yet. Strategy: invert neutral scale, reduce primary saturation 10-20%

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable
- **Scale:** xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48)

## Layout
- **Approach:** Grid-disciplined — sidebar + main content + optional info panel
- **Grid:** Single column mobile, sidebar + main on tablet, full 3-panel on desktop
- **Max content width:** No max (fills available space)
- **Border radius:** xs:4px, sm:8px, md:12px, lg:16px, xl:24px, full:9999px

## Motion
- **Approach:** Minimal-functional — transitions aid comprehension, nothing decorative
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(50-100ms) short(150-250ms) medium(250-400ms) long(400-700ms)

## Mobile UX Enhancements

### Safe Area Handling
- **Viewport:** `viewport-fit=cover` on meta tag
- **CSS vars:** `env(safe-area-inset-top/right/bottom/left)` on `:root`
- **Applied to:** header, input bar, sidebar, toasts, bottom sheets, floating buttons

### Touch Interactions
- **Message actions:** Long-press (500ms) → context menu with emoji bar + actions
- **Swipe-to-reply:** Right swipe (60px threshold) on messages
- **Touch targets:** Minimum 44px for all interactive elements
- **Haptic feedback:** `navigator.vibrate(50)` on long-press trigger

### Mobile Input Bar
- **Toolbar collapse:** 4 icons → single "+" button on screens < 768px
- **"+" action sheet:** Bottom sheet grid with: File, Emoji, GIF, Snippet
- **Textarea max-height:** 120px on mobile (200px on desktop)
- **Safe area padding:** `padding-bottom: env(safe-area-inset-bottom)` on input bar

### Bottom Sheets
- **Usage:** Info panel, emoji/GIF picker, input actions (mobile only)
- **Snap points:** 50%, 75%, 100% of viewport height
- **Drag handle:** 36px wide, 4px tall, centered, `--neutral-300` color
- **Dismiss:** Swipe down past 25% threshold, tap backdrop, or back button
- **Scrollable:** Content scrolls independently within sheet

### Toast Notifications
- **Width:** `min(calc(100vw - 32px), 360px)`
- **Position (mobile):** Bottom-center with safe-area offset
- **Position (desktop):** Top-right (current behavior preserved)
- **Safe area:** `bottom: calc(16px + env(safe-area-inset-bottom))`

### Workspace Strip (Mobile Sidebar)
- **Touch targets:** 44px minimum (increased from 32px)
- **Active feedback:** Scale animation on press
- **Spacing:** 4px gap between workspace avatars

### Scroll Behavior
- **Message list:** `overscroll-behavior: contain` — prevents iOS bounce issues
- **Sidebar:** Same overscroll containment

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-21 | Initial design system created | Documented existing design tokens from UI_SPEC.md |
| 2026-03-21 | Mobile UX enhancement plan | Based on competitive analysis of WhatsApp, Telegram, Slack, Discord mobile patterns |
| 2026-03-21 | Long-press over swipe for primary actions | Discord/WhatsApp pattern — more discoverable than swipe, less gesture conflict with iOS |
| 2026-03-21 | Bottom sheets over full-screen modals | Telegram/Discord pattern — maintains context, faster dismiss, progressive disclosure via snap points |
| 2026-03-21 | Collapsed toolbar (+) over inline icons | Slack pattern — keeps input bar clean, grid layout in sheet is more touch-friendly |
| 2026-03-21 | Bottom-center toasts on mobile | WhatsApp/Telegram standard — thumb-friendly, doesn't block message list |
