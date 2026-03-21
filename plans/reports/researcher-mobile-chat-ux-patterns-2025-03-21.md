# Mobile Chat UX Research Report
**Date:** March 21, 2025
**Focus:** WhatsApp, Telegram, Slack, Discord, iOS/Android best practices
**Scope:** Message actions, input bars, info panels, navigation, safe areas, gestures, notifications, emoji pickers

---

## 1. Message Actions on Touch (Long-Press Menus)

### Current Implementation Across Apps

**WhatsApp Mobile:**
- Long-press on message reveals floating action bar at top of screen
- Actions displayed as icons: Copy, Delete, Forward, Pin, Edit, More (...)
- Haptic feedback on iOS (Haptic Touch); vibration on Android
- Trigger time: ~0.5-1 second press-and-hold
- Visual: Action bar overlays message list, can be dismissed by tapping elsewhere

**Telegram iOS:**
- Similar long-press pattern with context menu
- Options: Reply, Pin, Copy, Delete, Forward, Select
- Swipe to left reveals quick-action buttons (reply forward arrow visible during swipe)
- Haptic Touch + visual feedback (scale animation on pressed item)

**Discord Mobile:**
- Long-press opens modal menu with emoji reactions at top
- Below: Copy Message ID, Pin, Edit (if own), Delete (if own), Mark As Read
- Emoji reaction bar is always visible—users can add reactions without full menu

**Slack Mobile:**
- Swipe left/right on message reveals quick reactions
- Long-press or "more" button opens full action menu
- Newer UI trend: Direct emoji reactions visible without menu interaction

### UX Friction Points

1. **Frequent actions hidden:** Copy, edit, delete require long-press + menu navigation
2. **User preference mismatch:** Research shows users prefer tap-based actions for frequent tasks—faster response, better satisfaction
3. **Discovery problem:** New users don't discover long-press actions without hints
4. **Swipe vs long-press confusion:** Some apps use swipe, others use long-press; no standard

### Current Trend & Improvements

Modern chat apps adding:
- **Direct emoji bar** below/beside message (visible by default or on hover)
- **Tap-based quick actions:** Edit/copy placed directly in emoji bar or as persistent buttons
- **Swipe-to-reply:** Right swipe opens reply box (Google Messages standard)
- **Context menus smarter:** Only show relevant actions (e.g., don't show "edit" on received messages)

### Implementation Recommendation for Agent Playground

```
Priority order (by frequency of use):
1. Emoji reactions (most frequent)
2. Reply (very frequent)
3. Copy (frequent)
4. Edit (own messages only)
5. Delete (own messages only)
6. Forward/Share (less frequent)
7. Pin (rare in most chat contexts)

UI Pattern:
- Show emoji bar by default below message (mobile: floating pill, swipeable for more)
- On long-press: Show full action menu anchored to touch point
- On swipe-right: Open reply composer with quoted message
```

---

## 2. Chat Input Bar on Mobile

### How Top Apps Handle Small Screens

**WhatsApp Mobile:**
- Fixed position at bottom with safe-area padding
- Text input expands vertically (max ~3 lines before scroll)
- Toolbar: Camera, gallery, paperclip (attachments) collapse into single "+" button on very narrow screens
- Emoji button always visible beside send button

**Telegram iOS:**
- Input grows vertically up to ~4 lines
- Toolbar icons: Attach file, emoji, send (minimal default)
- Long-press on send button reveals schedule/voice message options
- Keyboard dismissal leaves input bar visible (sticky)

**Slack Mobile:**
- Minimal toolbar by default (just text + send)
- Tap "+" opens action menu (threads, files, emoji, etc.) as bottom sheet
- Input field expands but keeps emoji and send buttons visible

**Discord Mobile:**
- Text input + emoji button always visible
- Attachment button opens action sheet
- Voice channel input shows "Hold to talk" button instead of text

### Keyboard Handling Edge Cases

**iOS-Specific Challenges:**
1. Fixed input gets hidden behind keyboard
   - Solution: Position fixed element at `bottom: 0` as direct body child; iOS auto-scrolls to bring focused input above keyboard
2. Safe area inset bottom (home indicator) on notched phones
   - Solution: `padding-bottom: env(safe-area-inset-bottom)`
3. Bounce scroll pushes input off-screen
   - Solution: `overscroll-behavior: contain` on message list

**CSS Grid Pattern for Chat Input:**
```css
.chat-layout {
  display: grid;
  grid-template-rows: 1fr auto auto;
  grid-template-areas: "messages" "keyboard" "input";
}

.messages {
  grid-area: messages;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.keyboard-spacer {
  grid-area: keyboard;
  height: env(keyboard-inset-height, 0px);
}

.input-bar {
  grid-area: input;
  position: relative;
  padding-bottom: env(safe-area-inset-bottom);
}
```

### Toolbar Collapse Strategy

**Breakpoint pattern:**
- Full width (>600px): Attach, Gallery, Emoji, Send all visible
- Medium (400-600px): Attach/Gallery combined into single icon or "+" menu
- Narrow (<400px): "+" menu only, emoji + send buttons visible

**Implementation:**
```css
.toolbar {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: 8px;
}

@media (max-width: 600px) {
  .toolbar {
    grid-template-columns: 1fr auto auto;
  }

  .attach-button,
  .gallery-button {
    display: none;
  }

  .add-menu-button {
    display: block;
  }
}
```

### Expandable Actions Pattern

Mobile chat apps prefer bottom sheets for additional actions:
- Tap "+" → Bottom sheet slides up with: Camera, Gallery, File, Sticker, GIF, Location
- Non-modal (allows dismissal by tapping outside or swiping down)
- Drag handle at top for clarity
- Grid layout (3-4 items per row on portrait)

---

## 3. Info/Details Panel on Mobile

### Pattern Variations Across Apps

**WhatsApp Mobile:**
- Tap conversation name at top → Full-screen modal slides in from right
- Displays: Group members, group description, media gallery, shared files
- Slide back or swipe left to dismiss
- Back navigation with arrow button at top-left

**Telegram iOS:**
- Tap info icon (ⓘ) at top → Bottom sheet slides up
- Shows: Members, pinned messages, shared media, search within chat
- Can scroll within sheet; dismissible by swiping down
- Snap points: 50%, 75%, 90% of viewport height

**Slack Mobile:**
- Tap channel name → Side panel slides in from right (if screen width allows) OR bottom sheet
- Shows: Channel topic, members, bookmarked messages, files
- Search within panel functionality

**Discord Mobile:**
- Tap channel name → Bottom sheet with channel info & members
- Swipeable up to full-screen if needed
- Member list expandable/collapsible

### Bottom Sheet vs Full-Screen Decision

**Use Modal Bottom Sheet (blocks background) when:**
- Performing critical action (delete conversation, leave group)
- Requires focused attention (selecting multiple messages)
- High-priority information only

**Use Non-Modal Bottom Sheet (allows background interaction) when:**
- Viewing reference info (members, settings, media gallery)
- User might want to switch context quickly
- Info is supplementary, not critical

**Use Full-Screen Modal when:**
- Large amount of content (member profiles, pinned message thread)
- Complex interaction needed (search, filtering)
- On very narrow screens (<350px width)

### Implementation Pattern

```
Bottom Sheet Behavior:
- Default height: 50% of viewport
- Drag handle at top (visual affordance)
- Snap points: [50%, 75%, 100%] for progressive disclosure
- Content scrollable within sheet (independent scroll)
- Dismiss: Swipe down past threshold OR tap outside OR back button
- Momentum: Swipe momentum carries sheet to nearest snap point
```

---

## 4. Navigation Patterns on Mobile

### Tab Bar vs Hamburger Menu

**Tab Bar (Industry Standard for Chat Apps):**
- WhatsApp, Telegram, Slack, Discord all use bottom tab bar on mobile
- Typically 3-5 tabs: Messages/Chats, Contacts, Calls, Settings
- Always visible, single tap to switch
- Thumb-friendly (bottom of screen)
- Requires space but improves discoverability

**Hamburger Menu (Less Common Now):**
- Some apps use hamburger + top navigation for secondary features
- Better space efficiency but worse discoverability
- Not recommended as primary navigation on mobile

### iOS Gesture Conflicts to Avoid

**Critical:** Horizontal swipe from left/right screen edge is iOS system gesture for back/close
- Don't place swipe-to-reveal interactions at screen edges
- Leave minimum 50px margin from edges for system gestures
- Horizontal swipes in center of screen are safe (e.g., swipe to reply)
- Document: iOS system gestures override app swipes at edges

### Conversation List Navigation

**Pull-to-refresh pattern:**
- Drag down from top of conversation list → Spinner → Reload messages
- Visual feedback is critical (spinner, pull distance indicator)
- Threshold-based (doesn't refresh until user pulls past ~50px threshold)
- Common in: WhatsApp, Telegram, Twitter
- Trend: Less common in modern chat (prefer infinite scroll + load-older)

**Swipe-on-conversation list:**
- Swipe left on conversation → Reveal: Archive, Mark unread, Delete buttons
- Swipe right → Pin conversation to top
- Quick actions without opening conversation
- Feedback: Icons appear during swipe with spring animation

---

## 5. Safe Area Handling for Notched/Dynamic Island Phones

### The Problem: Device Variability

**iPhone Safe Area Heights:**
- iPhone 13 and earlier: 47pt top safe area (notch)
- iPhone 14 Pro/Pro Max: 59pt top safe area (Dynamic Island)
- iPhone 15+: Similar 59pt for Dynamic Island
- iPad: 0pt (no notch), but bottom insets for home indicator

**Impact on Chat UI:**
- Fixed headers (conversation title, date separator) can get covered by notch
- Status bar + app header + safe area space = significant top padding
- Message input bar must account for bottom safe area (home indicator)

### Implementation Approach

**CSS Environment Variables (Web/React):**
```css
/* Applied to all major browsers; iOS Safari, Android Chrome */
body {
  --safe-area-top: env(safe-area-inset-top, 0px);
  --safe-area-right: env(safe-area-inset-right, 0px);
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-left: env(safe-area-inset-left, 0px);
}

.app-header {
  padding-top: var(--safe-area-top);
  padding-left: var(--safe-area-left);
  padding-right: var(--safe-area-right);
}

.input-bar {
  padding-bottom: var(--safe-area-bottom);
  padding-left: var(--safe-area-left);
  padding-right: var(--safe-area-right);
}

.floating-button {
  right: calc(16px + var(--safe-area-right));
  bottom: calc(16px + var(--safe-area-bottom));
}
```

**React Native Approach:**
```javascript
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function ChatScreen() {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{
        paddingTop: insets.top,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}>
        {/* Header content */}
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* Messages */}
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom }}>
        {/* Input bar */}
      </View>
    </SafeAreaView>
  );
}
```

### Viewport Meta Tag (Web)

```html
<meta name="viewport" content="viewport-fit=cover, width=device-width, initial-scale=1.0">
```

This allows CSS env() variables to work correctly on notched devices.

### Testing Strategy

- Test on: iPhone 13 (notch), iPhone 14 Pro (Dynamic Island), iPad (no notch)
- Don't hardcode: 44px, 59px, etc.; always use safeAreaInsets API
- Rotate device to landscape: Safe areas change (especially on iPad)
- Check: Status bar visible? Headers not clipped? Input bar above keyboard?

---

## 6. Pull-to-Refresh & Swipe Gestures

### Pull-to-Refresh (Message List)

**Standard Behavior:**
1. User pulls down from top of scrollable message list
2. Spinner/icon appears indicating "pull to refresh"
3. User releases past threshold (~50px) → Spinner changes to loading state
4. API call fires; new messages loaded
5. Spinner disappears; list updates or scrolls to new message

**Best Practice Metrics:**
- Threshold distance: 50-80px before refresh triggers
- Visual feedback: Icon rotates as user pulls; changes color at threshold
- Loading indicator: Activity spinner while request in flight
- Duration: Should feel snappy (<1 second to show first results)

**When to Use:**
- For frequently-updating content (timelines, message feeds)
- Where users expect fresh data (news, email, chat)

**When NOT to Use:**
- Chat apps with infinite scroll (less common now)
- Where data updates happen via WebSocket (real-time sync)
- On mobile web (can interfere with browser's native pull-to-refresh)

### Swipe-to-Reply (Message)

**Google Messages Standard:**
- Swipe right on message → Message "bounces" right
- Reply composer opens pre-filled with quote of that message
- Swipe continues smoothly into compose field

**Implementation Details:**
- Gesture: Right swipe only; left swipe doesn't do same (asymmetric)
- Distance: ~60-100px swipe triggers reply
- Visual: Message slides right; quote preview appears
- Feedback: Haptic vibration at trigger point
- Dismissal: Swipe left or tap ×

### Swipe-to-Archive/Delete (Conversation List)

**Standard Swipe Actions:**
- Swipe left on conversation → Reveal: Archive, Delete, Mute buttons
- Swipe right → Pin to top
- Buttons appear with spring animation
- Tap button to execute action

**Visual Design:**
- Archive button: Yellow/orange background
- Delete button: Red background
- Action buttons 64px wide minimum (thumb-friendly)
- Buttons reveal after ~30% swipe distance
- Spring back if user doesn't complete swipe past threshold

---

## 7. Toast/Notification Positioning on Mobile

### Positioning Best Practices

**Bottom Center (RECOMMENDED for Chat Apps):**
- 16px from bottom of screen
- Horizontally centered
- Easy thumb reach
- Doesn't block message list
- Standard in WhatsApp, Telegram, Slack
- CSS: `bottom: 16px; left: 50%; transform: translateX(-50%);`

**Top Center (For High-Priority Alerts):**
- Below status bar (account for safe area)
- Horizontally centered
- Good visibility
- Less common in chat apps
- Avoid top-right (conflicts with screen readers)

**Top-Left (For Notifications):**
- Rare; sometimes used for mini notification badges
- Not recommended for toast messages

### Toast Design Specifications

**Text Content:**
- Maximum 1 line (ideal)
- Up to 2 lines (acceptable)
- Keep message concise: "Message copied", "Deleted message", "Connection restored"
- Action buttons: 1 optional button (e.g., "Undo", "Retry", "View")

**Visual Design:**
- Background: Semi-transparent dark (rgba(0,0,0,0.8)) or opaque color
- Text color: White (high contrast)
- Padding: 16px horizontal, 12px vertical
- Border-radius: 8px or 50px (rounded pill shape)
- Elevation: Above all other content (z-index high)

**Timing:**
- Show duration: 3-4 seconds (auto-dismiss)
- Allow manual dismiss: Tap on toast or swipe up
- Don't force: User shouldn't need to wait; provide action immediately

**Accessibility:**
- Use aria-live="polite" for screen readers
- Don't hide critical info in toast-only messages
- Provide alternative way to perform action

### iOS-Specific: Safe Area Offset

```css
.toast {
  position: fixed;
  bottom: calc(16px + env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  border-radius: 8px;
  z-index: 9999;
}
```

---

## 8. Emoji/GIF Pickers on Mobile

### Presentation Patterns

**Keyboard-Height Panel (Most Common):**
- Emoji picker appears above keyboard (not full-screen)
- Height: ~40-50% of viewport (230-280px on iPhone)
- Dismissible: Swipe down, tap keyboard arrow, or tap outside
- Content: Scrollable categories with search at top
- Used by: WhatsApp, Telegram, Slack, Discord

**Full-Screen Sheet (Less Common):**
- Used when app wants maximum emoji space (search + all categories visible)
- Trend: Less preferred on mobile (takes too much screen space)
- Only use if app requires advanced emoji search/filtering

**Inline Keyboard Tab:**
- iOS: Native keyboard has emoji tab (app delegates to system)
- Android: Similar native emoji keyboard
- Apps build custom emoji pickers above this

### Emoji Picker Structure

**Top Bar:**
- Search text input (find emojis by keyword)
- Search works on: emoji name, alias, unicode description
- Clear button (×) appears when text entered

**Category Tabs:**
- Recently used (thumbtack/clock icon)
- Smileys & emotion
- People & body
- Animals & nature
- Food & drink
- Travel & places
- Activities
- Objects
- Symbols
- Flags

**Skin Tone Selector:**
- Long-press or tap-and-hold on people-category emoji
- Swipe horizontally to select tone
- X position of swipe maps to tone selection (left=default, right=darkest)
- Visual: 5-6 tone options displayed as swipeable carousel

**Search Functionality:**
- Real-time filtering as user types
- Matches emoji names: "smile" → 😊, 😄, etc.
- Matches descriptions: "happy" → smiling faces
- Recent emojis always appear first

### GIF Picker Integration

**Separate Tab or Integrated:**
- Some apps: GIF picker as separate interface (Giphy/Tenor API)
- Modern trend: GIF tab within emoji picker
- Access: Swipe left in emoji picker OR separate GIF button in input toolbar

**GIF Picker Features:**
- Search by keyword (powered by Giphy/Tenor)
- Trending GIFs tab
- Recently sent GIFs
- Grid layout (2-3 columns on mobile)
- Tap to preview; tap again to send
- Image proxy for privacy (don't load from external API until user selects)

### Implementation Recommendations

```
CSS Structure:
.emoji-picker-container {
  position: absolute;
  bottom: 100%; /* Above keyboard */
  width: 100%;
  height: 280px;
  background: #f5f5f5;
  border-top: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
}

.emoji-search {
  padding: 12px 16px;
  flex-shrink: 0;
}

.emoji-categories {
  display: flex;
  gap: 0;
  border-top: 1px solid #e0e0e0;
  flex-shrink: 0;
  overflow-x: auto;
}

.emoji-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
  padding: 8px;
}

.emoji-item {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  cursor: pointer;
  border-radius: 4px;
}

.emoji-item:active {
  background: rgba(0, 0, 0, 0.1);
}
```

**Touch Handling:**
- Emoji grid items min 44px × 44px for touch (padding adds spacing)
- Skin tone swipe: Track horizontal movement; lock vertical once swipe starts
- Haptic feedback: Vibrate on emoji selection (iOS) or tap feedback (Android)
- Keyboard still partially visible (no full takeover)

---

## Key Takeaways for Agent Playground Mobile UX

### Priority Implementation Order

1. **Message reactions (emoji bar)** - Most frequently used interaction
2. **Input bar with safe area padding** - Core functionality, complex on iOS
3. **Long-press context menus** - Standard expected behavior
4. **Emoji picker** - High-frequency feature
5. **Conversation info bottom sheet** - Reference feature
6. **Toast notifications** - Feedback mechanism
7. **Pull-to-refresh** - Nice-to-have (if using polling)
8. **Swipe gestures** - Advanced (start with long-press first)

### Critical CSS/HTML Patterns to Implement

```html
<meta name="viewport" content="viewport-fit=cover, width=device-width, initial-scale=1.0">
```

```css
:root {
  --safe-area-top: env(safe-area-inset-top, 0px);
  --safe-area-right: env(safe-area-inset-right, 0px);
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-left: env(safe-area-inset-left, 0px);
}

.input-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding-bottom: var(--safe-area-bottom);
  padding-left: var(--safe-area-left);
  padding-right: var(--safe-area-right);
}

.message-list {
  overscroll-behavior: contain;
  padding-bottom: calc(env(keyboard-inset-height, 0px) + 80px);
}
```

### Testing Checklist for Mobile

- [ ] iPhone notch (13) and Dynamic Island (14 Pro): Headers not clipped
- [ ] iPhone SE (no notch): Layout symmetric
- [ ] iPad landscape: Safe areas adjust correctly
- [ ] iOS keyboard: Input bar appears above keyboard, not hidden
- [ ] Android keyboard: Same behavior as iOS
- [ ] Pull-to-refresh: Works on message list, not accidental trigger
- [ ] Long-press: Triggers with haptic feedback, menu positioned well
- [ ] Emoji picker: Opens above keyboard, doesn't cover input
- [ ] Bottom sheet: Smooth drag, snap points work, dismissible
- [ ] Toast: Visible, doesn't cover critical content
- [ ] Swipe gestures: No conflict with iOS system gestures

---

## Sources

- [CometChat Blog: UI/UX Best Practices for Chat App Design](https://www.cometchat.com/blog/chat-app-design-best-practices)
- [16 Chat UI Design Patterns That Work in 2025 - Bricx Labs](https://bricxlabs.com/blogs/message-screen-ui-deisgn)
- [Redesigning WhatsApp UX: Small Fixes, Big Impact - Medium](https://medium.com/@f20230750/redesigning-whatsapp-ux-small-fixes-big-impact-1be1d5a90d60)
- [Why WhatsApp's Chat UI Just Works - Medium](https://medium.com/design-bootcamp/why-whatsapps-chat-ui-just-works-and-what-you-can-learn-from-it-bd89fb114423)
- [Mobile Navigation Patterns & Examples - Justinmind](https://www.justinmind.com/blog/mobile-navigation/)
- [Telegram Mini App UX Guide - Turumburum](https://turumburum.com/blog/telegram-mini-app-beyond-the-standard-ui-designing-a-truly-native-experience)
- [How to Handle Safe Area Insets - Felgo Blog](https://blog.felgo.com/cross-platform-app-development/notch-developer-guide-ios-android)
- [safeAreaInsets - Apple Developer Documentation](https://developer.apple.com/documentation/uikit/uiview/safeareainsets)
- [Bottom Sheet UX Guidelines - NN/G](https://www.nngroup.com/articles/bottom-sheet/)
- [Sheets vs. Dialogs vs. Snackbars - LogRocket Blog](https://blog.logrocket.com/ux-design/sheets-dialogs-snackbars/)
- [Contextual Menus: Best Practices - NN/G](https://www.nngroup.com/articles/contextual-menus/)
- [Context Menus - Apple Developer Guidelines](https://developer.apple.com/design/human-interface-guidelines/context-menus)
- [How to Make Fixed Content Go Above iOS Keyboard - codestudy.net](https://www.codestudy.net/blog/how-to-make-fixed-content-go-above-ios-keyboard-like-android-simple-css-solution)
- [VirtualKeyboard API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/VirtualKeyboard_API)
- [What Is a Toast Notification - MagicBell Blog](https://www.magicbell.com/blog/what-is-a-toast-message-and-how-do-you-use-it)
- [Toast UI Design Best Practices - Mobbin](https://mobbin.com/glossary/toast)
- [Designing Swipe-to-Delete Interactions - LogRocket Blog](https://blog.logrocket.com/ux-design/accessible-swipe-contextual-action-triggers/)
- [Pull-to-Refresh Design Pattern - UI Patterns](https://ui-patterns.com/patterns/pull-to-refresh)
- [Innovating on Pull-to-Refresh - WebFX Blog](https://www.webfx.com/blog/web-design/augmented-pull-to-refresh/)
- [How to Customize Swipe Gestures in Google Messages - Android Central](https://www.androidcentral.com/apps-software/how-to-customize-swipe-gestures-in-google-messages)

---

## Unresolved Questions

1. **Swipe gesture edge margins:** Exact pixel distance from edges to avoid iOS system gesture conflicts? (Research suggests ~50px but varies by device)
2. **Emoji picker height on iPad:** Should it scale differently than iPhone? (Not found definitive guidance)
3. **Bottom sheet snap points:** Are there standard percentages across iOS/Android? (Found variations: 25%, 50%, 90% but no official standard)
4. **Message action priority:** Is there user research on which actions (emoji, reply, copy, edit) are most frequent? (No specific data found, inferred from app design)
5. **GIF picker API:** Which providers (Giphy, Tenor, etc.) do top apps use on mobile? (Not specified in search results)

