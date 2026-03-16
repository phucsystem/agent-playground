# React Chat UI Libraries: Comprehensive Research Report
**Date:** March 16, 2026
**Research Focus:** Multi-user group messaging + AI agent support + Next.js compatibility

---

## Executive Summary

Evaluated 8 major React chat UI libraries. **No single library excels at all requirements**, but clear winners exist by use case:

- **Best overall (commercial):** Stream Chat React SDK – strongest AI integration, markdown support, proven performance
- **Best budget/open source:** Chatscope (MIT) – lightweight, headless, requires backend implementation
- **Best self-hosted:** Rocket.Chat (MIT) – full-featured, complete control, steep learning curve
- **Hybrid approach viable:** Use assistant-ui for AI rendering inside a custom multi-user chat shell

**Token cost:** Stream/Sendbird/CometChat charge per monthly active users (MAU). Ranges $99–$1,579/mo for production.

---

## Detailed Comparison

### 1. **Stream Chat React SDK** ⭐ Best Overall

**Company:** getstream.io (15K+ GitHub stars)
**License:** Proprietary, free dev tier available
**Open Source:** No (but APIs documented)

#### Features
- ✅ **Group messaging:** Full support via channels (tested at scale)
- ✅ **AI/agent support:** Native AI components (`AIMessageComposer`, `AIMarkdown`, `StreamingMessage`)
  - Streaming messages with typewriter animation
  - Markdown + code block syntax highlighting
  - Custom tool component rendering
  - LLM provider integrations (OpenAI, Gemini, Anthropic)
- ✅ **File attachments:** Images, videos, documents, URL previews, Giphy integration
- ✅ **Presence:** Real-time online/offline status, typing indicators
- ✅ **Bundle size:** Uses virtualization for efficient rendering; moderately optimized
- ✅ **Community:** Active, 15K+ GitHub stars, regular releases

#### Pricing
| Plan | MAU | Cost | Features |
|------|-----|------|----------|
| Free (Build) | 100 | $0 | Dev/prototype only |
| Start | 10K | ~$499/mo | Production ready |
| Elevate | 25K | ~$1,299/mo | Higher limits |
| Enterprise | 100K+ | Custom | Dedicated support |

*Note: Overage charges $0.10–0.30 per additional MAU*

#### Supabase Compatibility
- ✅ Can use Supabase as custom backend
- Designed for flexible deployment (bring your own auth, storage)
- Well-documented REST API for integration

#### Verdict
**Best choice for:** Teams wanting mature, AI-first chat with commercial support. High cost but lowest implementation time. Strong for multi-user + AI hybrid scenarios.

---

### 2. **Sendbird UIKit React** ⭐ Good Alternative

**Company:** sendbird.com
**License:** MIT (open source UIKit, proprietary backend)
**Open Source:** Partially (UIKit code on GitHub)

#### Features
- ✅ **Group messaging:** Group channels (up to 100 members, 300 in dedicated instances)
- ⚠️ **AI support:** No native AI components; requires custom implementation
  - Can add streaming messages with custom logic
  - No built-in markdown/code block rendering
- ✅ **File attachments:** Unlimited storage per plan; supports images, video, documents
- ✅ **Presence:** User status, typing indicators, read receipts
- ✅ **Bundle size:** Moderate; open source allows tree-shaking
- ✅ **Community:** 4K+ GitHub stars, maintained by Sendbird

#### Pricing
| Plan | MAU | Peak Concurrent | Cost | Features |
|------|-----|-----------------|------|----------|
| Developer | 100 | 10 | Free | All Pro features, community support |
| Starter | 1K | 50 | ~$199/mo | Priority support |
| Pro | 10K | 300 | ~$499/mo | Advanced features |
| Enterprise | 100K+ | Custom | Custom | Dedicated account |

*Free tier: No credit card required*

#### Supabase Compatibility
- ✅ Can integrate via REST API + webhook automations
- Sendbird handles auth/storage; custom backend integration limited
- Pipedream provides Supabase ↔ Sendbird connectors

#### Verdict
**Best choice for:** Teams wanting cost-effective, proven group chat without AI focus. Free developer tier good for prototyping. MAU pricing scales better than Stream.

---

### 3. **CometChat UI Kit** ⭐ Feature-Rich

**Company:** cometchat.com
**License:** Proprietary (open source announced, not yet released)
**Open Source:** Partial (marketing claims "open source" but specific license unclear)

#### Features
- ✅ **Group messaging:** Full 1:1, group, broadcast chat support
  - Threaded conversations
  - Mentions and @-tags
  - Message reactions
- ⚠️ **AI support:** Not built-in; must implement custom
- ✅ **File attachments:** Images, videos, audio, documents, media sharing
- ✅ **Presence:** Real-time status indicators, read receipts, typing indicators
- ✅ **Audio recording:** Built-in audio message support
- ✅ **Community:** Popular, 3K+ GitHub stars, well-maintained

#### Pricing
| Plan | MAU | Cost | Features |
|------|-----|------|----------|
| Free | 25 | $0 | Testing/integration |
| Growth | 1K | $109/mo | Core + advanced |
| Scale | 50K | $1,579/mo | Enterprise features |

*No credit card required for free plan*

#### Supabase Compatibility
- Proprietary backend; Supabase integration not officially documented
- Can implement custom backend via REST API, but limited

#### Verdict
**Best choice for:** Teams wanting polished UI with audio/video. Not ideal for AI integration. Good for team communication tools, not AI-first apps.

---

### 4. **TalkJS** ⭐ Quick Setup

**Company:** talkjs.com
**License:** Proprietary, free dev tier
**Open Source:** No

#### Features
- ✅ **Group messaging:** Supports up to 20 users (Basic), 40 (Growth), unlimited (Enterprise)
- ⚠️ **AI support:** No native support
- ⚠️ **File attachments:** Not clearly documented (likely minimal)
- ✅ **Presence:** User roles, participant vs. guest distinction, typing indicators
- ✅ **Easy embed:** Drop-in React component, quick setup (10 min)
- ✅ **Customization:** Extensive theme system, style/markup control

#### Pricing
| Plan | MAU | Cost | Group Size |
|------|-----|------|-----------|
| Free Dev | Unlimited | $0 | Limited production |
| Basic | 10K | ~$279–$499/mo | 20 users |
| Growth | 25K | ~$700/mo | 40 users |
| Enterprise | 40K+ | Custom | Unlimited |

*Overage: $0.03–0.04 per additional MAU*

#### Supabase Compatibility
- Proprietary backend; Supabase integration not documented
- Not suitable for custom backend implementations

#### Verdict
**Best choice for:** Quick MVP launch with minimal config. NOT recommended for AI applications or Supabase-based projects.

---

### 5. **Chatscope React UI Kit** ⭐ Lightweight Open Source

**Company:** chatscope.io (independent developers)
**License:** MIT (fully open source)
**GitHub:** 1.7K stars, 150 forks

#### Features
- ✅ **Group messaging:** UI components provided; state management via `@chatscope/use-chat`
  - Designed for 1-1 and group conversations
  - Grouped messages state across multiple conversations
- ⚠️ **AI support:** No built-in; UI is headless (your backend logic)
- ⚠️ **File attachments:** Components exist, but no backend storage
- ⚠️ **Presence:** No built-in presence; requires custom implementation
- ✅ **Bundle size:** ~20–30KB (smallest of all options)
- ✅ **TypeScript:** Full type support (since v1.9.3)
- ✅ **Flexibility:** Headless design = full control over UX

#### Packages
```
@chatscope/chat-ui-kit-react   // UI components
@chatscope/chat-ui-kit-styles  // Pre-built styles
@chatscope/use-chat            // State management hook
```

#### Pricing
Free, MIT license. No SaaS backend; you provide/host your own.

#### Supabase Compatibility
- ✅ **Excellent** – Can pair with Supabase (Postgres + realtime) for custom backend
- Great for self-hosted scenarios
- Full control over data flow

#### Verdict
**Best choice for:** Teams with backend expertise wanting lightweight, fully customizable UI. Requires implementing chat backend yourself. Ideal for Supabase projects. Low cost, steep learning curve.

---

### 6. **Matrix/Element SDK** ⭐ Fully Open Source, Self-Hosted

**Company:** Element (matrix.org foundation)
**License:** AGPLv3 / GPLv3 + commercial license available
**GitHub:** 43K+ stars, mature protocol

#### Features
- ✅ **Group messaging:** Native support for public/private channels, threads, DMs
  - Decentralized architecture (federated)
- ⚠️ **AI support:** No built-in; protocol-agnostic (can add via bots/intents)
- ✅ **File attachments:** Full media sharing (images, video, documents)
- ✅ **Presence:** User status, typing indicators, device management
- ✅ **Security:** End-to-end encryption (E2EE) for 1-1 and group chats
- ✅ **Voice/Video:** WebRTC p2p and group calls
- ⚠️ **Complexity:** Not a simple drop-in component; requires full client/server setup

#### Self-Hosting Options
| Option | Cost | Users | Setup Complexity |
|--------|------|-------|------------------|
| ESS Community | Free | 100 | High |
| ESS Starter | Free | 200 | High |
| ESS Pro | $$ | Unlimited | High |
| Managed (Element.io) | $0 | Unlimited | None |

#### React Integration
- `matrix-react-sdk` – Full chat client
- `matrix-js-sdk` – Lower-level protocol library
- Cannot be used in isolation; requires a "skin" (typically Element Web)

#### Supabase Compatibility
- ✅ Can self-host on own infrastructure (compatible with Supabase backend for auth)
- Requires running a Synapse homeserver
- Not a simple REST API integration

#### Verdict
**Best choice for:** Organizations wanting complete control, decentralized deployment, E2EE. Steep learning curve. Overkill for simple group chat. Not recommended for AI-first apps.

---

### 7. **Rocket.Chat SDK** ⭐ Full-Featured Self-Hosted

**Company:** Rocket.Chat (community project)
**License:** MIT
**GitHub:** 43K+ stars, very active

#### Features
- ✅ **Group messaging:** Channels (public/private), DMs, group DMs, threads
- ⚠️ **AI support:** Integrations possible via Apps Engine, no native component library
- ✅ **File attachments:** Full file sharing, media handling
- ✅ **Presence:** User status, activity indicators
- ✅ **Admin features:** Moderation, user management, audit logs, retention policies
- ✅ **Extensibility:** Apps Engine framework for custom integrations
- ⚠️ **React integration:** PWA React implementation exists but not as drop-in component

#### Deployment Options
- **Self-hosted:** Full control, your infrastructure
- **Managed cloud:** Rocket.Chat hosts for you
- **Docker/K8s:** Easy containerized deployment

#### React/Web Implementation
- `Rocket.Chat.PWA.React` – React PWA client (not a component library)
- Must run full Rocket.Chat server + connect via REST API
- Not suitable for embedding in existing apps

#### Supabase Compatibility
- ✅ Can use Supabase for additional backend logic (auth, data sync)
- Requires running Rocket.Chat server separately
- REST API allows custom frontend integration

#### Verdict
**Best choice for:** Teams wanting full collaboration platform (not just chat component). Self-hosted, no usage charges. Requires DevOps expertise. Not for simple chat UX in existing apps.

---

### 8. **PubNub React Chat Components**

**Company:** PubNub (real-time platform)
**License:** Proprietary (components open source, backend proprietary)
**GitHub:** ~1K stars

#### Features
- ✅ **Group messaging:** Direct and group channels
- ⚠️ **AI support:** No native support
- ✅ **File attachments:** Supported but limited docs
- ✅ **Presence:** Online status, active users list, state tracking
- ✅ **Typing indicators:** Built-in
- ✅ **Message reactions:** Emoji support
- ✅ **Themes:** Light/dark + custom themes
- ✓ **TypeScript:** Full support

#### Pricing
| Plan | MAU | Cost | Features |
|------|-----|------|----------|
| Free | 200 | $0 | Dev/testing |
| Starter | 1K | $98/mo | Pay-as-you-grow |
| Growth | Custom | $$ | Dedicated support |

*Requires upgrade to paid once exceeding free tier*

#### Supabase Compatibility
- PubNub is a real-time messaging backbone; Supabase integration via webhooks possible
- Not designed as custom backend

#### Verdict
**Best choice for:** Teams wanting real-time messaging with built-in presence. Good middle ground between Sendbird and open source. Better pricing than Stream but no AI support.

---

## Hybrid Approach: assistant-ui + Custom Chat Shell

### Viability Assessment: ✅ **Recommended**

**Concept:** Use `assistant-ui` (lightweight, AI-focused) for rendering AI messages inside a custom multi-user chat interface.

#### Strengths
- ✅ assistant-ui is **streaming-first** (typewriter animation, token-by-token rendering)
- ✅ Excellent markdown/code block rendering for AI responses
- ✅ Works with any backend (Supabase, custom API, LangGraph, Vercel AI SDK)
- ✅ LocalRuntime adapter for bringing your own backend
- ✅ Lightweight (~15–20KB core)
- ✅ MIT licensed, fully customizable

#### Implementation Pattern
```
┌─────────────────────────────────────────┐
│  Multi-User Chat Shell (custom/headless)│
│  - User list, channel list              │
│  - Message list (group messages)        │
│  - Presence indicators                  │
│  - File upload UI                       │
└────────────┬────────────────────────────┘
             │
      ┌──────┴──────┐
      │             │
   ┌──▼──┐    ┌─────▼────┐
   │Human│    │AI Message │
   │Chat │    │ (assistant-ui)
   └─────┘    └───────────┘
             ↓
      ┌─────────────┐
      │   Backend   │
      │  Supabase   │
      │  or REST    │
      └─────────────┘
```

#### Cost
- **assistant-ui:** Free (MIT)
- **Backend:** Depends on choice (Supabase free tier: 500K API calls/mo)
- **Total:** $0 for prototypes, scales as you grow

#### Limitations
- ✅ No built-in file upload (must implement)
- ✅ No built-in presence (must implement)
- ✅ More work upfront vs. all-in-one SDK
- ✅ Suitable for teams with strong frontend engineering

#### Verdict
**Recommended if:**
- Backend expertise available
- Need maximum customization
- Prioritize cost control
- Want streaming AI rendering quality
- Plan to use Supabase or custom backend

---

## Comparison Matrix

| Feature | Stream | Sendbird | CometChat | TalkJS | Chatscope | Matrix | Rocket.Chat | PubNub |
|---------|--------|----------|-----------|--------|-----------|--------|------------|--------|
| **Open Source** | ❌ | ⚠️ | ⚠️ | ❌ | ✅ | ✅ | ✅ | ❌ |
| **Group Chat** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **AI Components** | ✅✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Markdown/Code** | ✅✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **File Attachments** | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | ✅ |
| **Presence/Status** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Free Tier** | ✅ (100 MAU) | ✅ (100 MAU) | ✅ (25 MAU) | ✅ (Dev mode) | ✅ (MIT) | ✅ (Self) | ✅ (Self) | ✅ (200 MAU) |
| **Supabase Compatible** | ✅ | ⚠️ | ⚠️ | ❌ | ✅ | ✅ | ✅ | ❌ |
| **Drop-in Component** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Custom Backend** | ✅ | ⚠️ | ⚠️ | ❌ | ✅ | ✅ | ✅ | ⚠️ |
| **Min. Production Cost** | $499/mo | $199/mo | $109/mo | $279/mo | $0 | $0 | $0 | $98/mo |

---

## Recommendation by Use Case

### **Use Case 1: AI-First SaaS (Chat + Agents)**
**Best:** Stream Chat React SDK
**Fallback:** Hybrid (assistant-ui + Supabase)
**Why:** Native AI components, streaming support, proven at scale

### **Use Case 2: Team Communication Platform**
**Best:** Rocket.Chat (self-hosted) or CometChat
**Fallback:** Sendbird
**Why:** Full-featured, mature, good presence/moderation

### **Use Case 3: Budget-Conscious Startup**
**Best:** Chatscope + Supabase
**Why:** Free, full control, can scale gradually

### **Use Case 4: Quick MVP Launch**
**Best:** TalkJS or Sendbird
**Why:** 10 min setup, no backend needed, reasonable free tiers

### **Use Case 5: E2E Encryption + Decentralization**
**Best:** Matrix/Element
**Why:** Only option with federation support, E2EE default

### **Use Case 6: Multi-User + AI Messages**
**Best:** Hybrid (assistant-ui + Chatscope + Supabase)
**Best Commercial:** Stream Chat React SDK
**Why:** Flexible, cost-effective, or proven integration

---

## Key Takeaways

1. **No single library is perfect** – Trade-offs exist between cost, AI support, and features
2. **Commercial solutions (Stream, Sendbird)** optimize for group chat; AI is add-on
3. **Open source options (Chatscope, Matrix, Rocket.Chat)** require more work but offer control
4. **Hybrid approach is viable** – assistant-ui + Chatscope/Supabase is legitimate path with clear trade-offs
5. **AI support is immature** across platforms – Only Stream has native components; others require custom rendering
6. **MAU pricing scales poorly** for small startups – Consider open source if product has limited initial users
7. **Supabase compatibility best** with Chatscope, Matrix, Rocket.Chat, or hybrid approach

---

## Unresolved Questions

1. **Chatscope group presence:** Exact mechanism for tracking online status in group conversations (not documented)
2. **CometChat license clarity:** Documentation claims "open source" but license not specified in public sources
3. **TalkJS file attachments:** Exact storage limits and handling not clearly documented
4. **Matrix scalability:** Performance characteristics for 1K+ concurrent users in single channel not tested
5. **assistant-ui + file handling:** Best practices for integrating file uploads with assistant-ui in multi-user context not established
6. **Rocket.Chat React component library:** Why PWA instead of component library; can it be embedded?

---

## Research Sources

- [Stream Chat React SDK](https://getstream.io/chat/sdk/react/)
- [Sendbird UIKit Documentation](https://sendbird.com/docs/chat/uikit/v3/react/overview)
- [CometChat UI Kits](https://www.cometchat.com/ui-kits)
- [TalkJS Documentation](https://talkjs.com/docs/UI_Components/React/)
- [Chatscope GitHub](https://github.com/chatscope/chat-ui-kit-react)
- [Matrix React SDK](https://github.com/matrix-org/matrix-react-sdk)
- [Rocket.Chat Documentation](https://docs.rocket.chat/)
- [PubNub Chat Components](https://www.pubnub.com/docs/chat/components/overview)
- [assistant-ui Documentation](https://www.assistant-ui.com/)
- [PubNub Pricing](https://www.pubnub.com/pricing/)
- [Stream Chat Pricing](https://getstream.io/chat/pricing/)
