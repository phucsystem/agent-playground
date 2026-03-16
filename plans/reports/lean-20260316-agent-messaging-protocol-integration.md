# Lean MVP Analysis: Agent Messaging Protocol Integration

## Problem Statement

Agent Playground already supports agent users in conversations (DMs + groups), but agents are **passive** — no framework processes incoming messages or generates responses. Need to integrate a communication protocol so external agents (Claude, GPT-4, custom) can **actively respond** to DMs and group mentions in real-time.

## Current State

**Already built:**
- Token-based auth for agents (`tok-claude-agent-001`, etc.)
- Agent users in DB with `role: 'agent'`, `is_agent: true`
- Supabase Realtime WebSocket for message delivery
- REST API for sending/receiving messages
- Group + DM conversation support
- File uploads, reactions, typing indicators

**Missing:**
- Webhook/event handler to trigger agent responses
- Agent framework integration (no LLM SDK connected)
- Protocol layer for agent-to-agent or human-to-agent communication
- Message routing (which agent responds to what)

---

## Target Users

| User Type | Description | Primary Need |
|-----------|-------------|--------------|
| Agent Builder | Developer testing their AI agent | Connect agent to chat, see it respond in real conversations |
| Human Tester | QA/user testing agent behavior | Chat naturally with agents in DM or group |
| Admin | Platform operator | Manage which agents are active, monitor conversations |

---

## Protocol Analysis

| Protocol | Best For | Maturity | Group Support | Effort |
|----------|----------|----------|---------------|--------|
| **Supabase Realtime (current)** | Internal messaging | Production | Yes | Already built |
| **Webhook + REST** | Simple agent integration | Battle-tested | Yes | 2-3 days |
| **MCP** | Tool/context access for agents | Industry standard | No (1:1 only) | 3-5 days |
| **A2A (Google)** | Multi-agent orchestration | Enterprise, 150+ orgs | Yes (delegation) | 7-10 days |
| **GoClaw** | Multi-channel distribution (Discord, Slack, Zalo, Matrix) | Production | Yes | 5-7 days |
| **Matrix** | Decentralized, federated chat | Stable (RFC 3100+) | Yes | 4-6 days |
| **ACP/OpenClaw** | Agent team orchestration | Early | Yes | 5-7 days |

---

## Recommended Approach: Layered Integration

### Option A: Webhook + Supabase Realtime (Simplest, Recommended for MVP)

```
Human sends message → Supabase Realtime → Webhook listener → Agent processes → POST /messages
```

- Leverage existing Supabase infrastructure
- Add Supabase Database Webhook or Edge Function trigger on `messages` INSERT
- Agent service subscribes, processes, responds
- **Effort: 2-3 days**
- **Supports: DM + Group, multiple agents**

### Option B: A2A Protocol Layer

```
Human sends message → A2A Server (Agent Card) → Route to correct agent → Agent responds via A2A → POST /messages
```

- Add A2A Agent Cards for each registered agent
- A2A handles discovery, capability negotiation, task delegation
- Better for multi-agent scenarios (agent A delegates to agent B)
- **Effort: 7-10 days on top of Option A**

### Option C: GoClaw Multi-Channel Bridge

```
Discord/Slack/Zalo message → GoClaw bridge → Agent Playground → Agent responds → Bridge back
```

- Single binary, connects 5+ channels
- Good if you want agents accessible from Discord/Slack too
- **Effort: 5-7 days**

---

## MVP Features (Phase 1 — Webhook + Realtime)

| Priority | Feature | User Value | Assumption |
|----------|---------|------------|------------|
| P1 | Agent webhook listener | Agents auto-respond to messages | Supabase Edge Functions sufficient for latency |
| P1 | Message routing | Correct agent gets correct messages | DM = direct, Group = @mention or all |
| P1 | Agent SDK/client library | Easy for builders to connect agents | TypeScript SDK is enough initially |
| P2 | Agent typing indicator | Natural conversation feel | Small UX win, low effort |
| P2 | Agent response streaming | Progressive message display | Supabase Realtime supports partial updates |
| P3 | Agent capability cards | Discover what agents can do | A2A-style, defer to Phase 2 |

## MVP Features (Phase 2 — A2A Multi-Agent)

| Priority | Feature | User Value | Assumption |
|----------|---------|------------|------------|
| P1 | A2A Agent Cards | Agent discovery + capabilities | Google A2A SDK stable enough |
| P1 | Agent-to-agent delegation | Agent A asks Agent B for help | Real use case in group chats |
| P2 | Conversation context passing | Agents understand full thread | Token limits manageable |
| P3 | Multi-channel bridge (GoClaw) | Agents accessible from Discord/Slack | Demand exists |

---

## Implementation Phases

| Phase | Focus | Key Features | Effort |
|-------|-------|--------------|--------|
| 1 | Core Agent Response | Webhook listener, message routing, agent SDK | S (2-3 days) |
| 2 | Multi-Agent Orchestration | A2A protocol, agent cards, delegation | M (7-10 days) |
| 3 | Multi-Channel | GoClaw bridge, Discord/Slack/Matrix | M (5-7 days) |

---

## Plan Structure Preview

```
plans/{date}-agent-messaging-integration/
├── plan.md
├── phase-01-webhook-agent-response/
│   ├── core.md    # Webhook listener, message routing
│   ├── data.md    # Agent config table, response logging
│   └── ui.md      # Typing indicator, streaming display
├── phase-02-a2a-multi-agent/
│   ├── core.md    # A2A server, agent cards
│   └── data.md    # Capability registry
└── phase-03-multi-channel/
    └── core.md    # GoClaw bridge setup
```

---

## GATE 1: Scope Validation

Before proceeding to `/ipa:spec`, complete this checklist:

- [ ] Confirmed: webhook-based approach fits latency requirements
- [ ] Decided: which LLM providers to support first (Claude, GPT-4, custom)
- [ ] Validated: Supabase Edge Functions vs external webhook server
- [ ] Confirmed: group chat routing strategy (@mention vs always-respond)
- [ ] Scope acceptable: Phase 1 only for MVP (2-3 days)

**Do NOT proceed if scope > 3 phases without re-scoping.**

---

## MVP Screens

| Screen | Purpose | Changes Needed |
|--------|---------|----------------|
| Chat (existing) | DM/Group with agents | Add streaming indicator, agent status badge |
| Admin (existing) | Manage agents | Add agent config (LLM provider, API key, system prompt) |
| Agent Dashboard (new) | Monitor agent activity | Response logs, latency metrics |

---

## Data Entities

| Entity | Description | Key Fields |
|--------|-------------|------------|
| agent_configs | Agent LLM settings | user_id, provider, model, system_prompt, api_key_encrypted, is_active |
| agent_response_logs | Response tracking | message_id, agent_id, latency_ms, tokens_used, error |

---

## User Flow

```
Human sends DM to agent → Webhook fires → Agent service picks up
  → Fetches conversation context → Calls LLM API → Sends response message
  → Human sees response in real-time (typing indicator → message appears)

Human @mentions agent in group → Same flow, but routing checks for mention
```

---

## Tech Decisions

| Decision | Context | Chosen | Rationale |
|----------|---------|--------|-----------|
| Event trigger | How agent knows about new messages | Supabase Database Webhook / Edge Function | Already in stack, zero new infra |
| Protocol (Phase 1) | Agent communication | REST + Supabase Realtime | Simplest, already works |
| Protocol (Phase 2) | Multi-agent | A2A (Google) | Industry backing, 150+ orgs, JS SDK |
| Multi-channel (Phase 3) | External platforms | GoClaw | Single binary, 5 channels, production-ready |

---

## Nice-to-Have (Post-MVP)

- **MCP integration** — Let agents use tools (web search, code execution) via MCP
- **Matrix federation** — Decentralized agent network across organizations
- **Agent memory** — Persistent context across conversations
- **Rate limiting** — Prevent agent response storms in busy groups
- **Cost tracking** — Per-agent token usage and billing

---

## Key Assumptions to Validate

1. **Supabase Edge Functions latency < 500ms** — Validate: benchmark with real LLM call
2. **Group @mention routing is sufficient** — Validate: test with 3+ agents in one group
3. **Builders want TypeScript SDK first** — Validate: ask 3+ agent builders
4. **A2A JS SDK is stable enough for Phase 2** — Validate: prototype with sample agent

---

## Out of Scope

- Voice/video agent interaction
- Agent training/fine-tuning
- Self-registration (keep invite-only)
- Payment/billing for agent usage
- Mobile native app

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM API latency spikes | Slow agent responses, bad UX | Streaming responses, timeout handling |
| Agent response loops | Two agents replying to each other forever | Max response depth per conversation, cooldown timer |
| API key security | Leaked keys = cost exposure | Encrypt at rest, never expose to client |
| Supabase Realtime limits | Message delivery delays at scale | Monitor, upgrade plan, or switch to dedicated WS |

---

## Next Step

After GATE 1 validation:
-> Run `/ipa:spec` to generate SRD.md + UI_SPEC.md for agent messaging integration
