# Agent Communication Protocols & Standards Research Report
**Date:** March 16, 2026
**Research Focus:** A2A, MCP, OpenClaw/GoClaw, Agent Protocol, Matrix, XMPP

---

## EXECUTIVE SUMMARY

Six major agent communication frameworks have emerged in 2025–2026:

| Protocol | Type | Maturity | A2H | A2A | Groups | SDK | Best For |
|----------|------|----------|-----|-----|--------|-----|----------|
| **A2A** | Interop | Stable v0.3 | ✅ | ✅ | ✅ | Python, JS | Enterprise agent delegation |
| **MCP** | Tool/Context | Stable | ✅ | ⚠️ | ❌ | All langs | LLM ↔ tools/data |
| **OpenClaw/ACP** | Orchestration | Active | ✅ | ✅ | ✅ | Python, Go | IDE-driven agent teams |
| **Agent Protocol** | API | Emerging | ✅ | ✅ | ❓ | Multiple | Universal agent API |
| **GoClaw** | Gateway | Stable | ✅ | ✅ | ✅ | Go, REST | Multi-LLM routing + 5 channels |
| **Matrix** | Messaging | Stable | ✅ | ⚠️ | ✅ | TypeScript, Python | Decentralized chat + bots |

**Verdict for Next.js Chat/Playground:**
- **For agent orchestration:** A2A (100+ partners, Linux Foundation backed)
- **For tool/context access:** MCP (industry standard as of Dec 2025)
- **For chat integration:** GoClaw (5 channels) or Matrix (decentralized, self-hosted)
- **For simple bot integration:** Agent Protocol (lightweight OpenAPI)

---

## 1. AGENT2AGENT PROTOCOL (A2A)

### What It Is
Open interoperability standard for agent-to-agent communication released by Google (April 2025), now hosted by Linux Foundation. Enables secure, structured communication between independent AI agent systems.

**Key Stat:** 150+ organizations adopted as of July 31, 2025. 50+ founding partners (Atlassian, Box, Cohere, Intuit, LangChain, MongoDB, PayPal, Salesforce, SAP, ServiceNow, UKG, Workday).

### Agent-to-Human & Agent-to-Agent
- **A2H:** Client agent formulates requests → remote agent executes → returns results. Human appears as client or observer.
- **A2A:** Native, peer-to-peer. "Agent Cards" (JSON) advertise capabilities; client agent selects best-suited remote agent for task type.
- **Protocol:** HTTPS transport + JSON-RPC 2.0 for requests/responses
- **Modalities:** Text, audio, video streaming supported

### Group Conversations
✅ **Yes.** Agents can form teams and coordinate on multi-agent tasks. Agent Card discovery enables team formation.

### SDKs & Libraries
- **Python SDK:** v0.3+, gRPC support, security card signing
- **JavaScript SDK:** Available
- **Community:** 40+ implementations across vendors

### Maturity & Status
- **Stable.** v0.3 released with production features.
- Linux Foundation backing ensures longevity.
- Adoption accelerating: 50 partners → 150+ in 9 months.

### Use in Next.js Chat/Playground
**Integration path:**
```
Next.js frontend → REST gateway → A2A client → remote agents
```
- Use REST-to-A2A bridge (Node.js) to expose agents to your chat UI
- Agents exchange messages via A2A protocol internally
- Agent Cards define "what agents can do" → UI can list available capabilities
- Not designed for direct browser use; requires backend gateway

**Pros:**
- Enterprise-grade security (HTTPS + auth)
- Multi-modal (text, audio, video)
- Strong ecosystem support
- Team-based agent orchestration

**Cons:**
- Requires backend gateway (not purely client-side)
- overkill for simple chatbot integration
- Less mature than MCP for tool/context use cases

---

## 2. MODEL CONTEXT PROTOCOL (MCP)

### What It Is
Anthropic's open standard (November 2024) for connecting AI systems to external data and tools. Now de facto industry standard after December 2025 donation to Linux Foundation's Agentic AI Foundation.

**Key Stat:** 1000s of MCP servers built by community. Adopted by ChatGPT, Claude, and major frameworks.

### Agent-to-Human & Agent-to-Agent
- **A2H:** LLM (as agent) uses tools/data to answer human query.
- **A2A:** Limited. MCP is not designed for agent-to-agent communication. Each agent connects independently to tool servers. Not recommended for agent-to-agent delegation.
- **Protocol:** JSON-RPC 2.0, transports = stdio (local) or HTTP SSE (remote)

### Group Conversations
❌ **No.** MCP is single-agent-to-tools. No native group or orchestration layer.

### SDKs & Libraries
- **Official:** Python, JavaScript, TypeScript
- **Community:** Go, Java, Rust, .NET
- **Server frameworks:** FastMCP (Python), TypeScript SDK
- **Public servers:** Filesystem, Git, Memory, Sequential Thinking, Fetch, Time, etc.
- **Community repositories:** 60K+ projects using AGENTS.md format

### Maturity & Status
- **Stable.** Released Nov 2024, industry-standard as of Dec 2025.
- Backed by Anthropic, OpenAI, Block (in AAIF).
- Ongoing development; new servers monthly.

### Use in Next.js Chat/Playground
**Integration path:**
```
Next.js frontend → Node.js MCP client → MCP servers (file, git, APIs, DBs)
Agent uses tools to answer questions
```

**Perfect for:** "Agent can read files, query databases, call APIs"

**Pros:**
- Industry standard (widest adoption)
- Easy to add tools (50+ ready-made)
- Lightweight (can run locally)
- Great documentation

**Cons:**
- Single-agent-to-tools (not A2A)
- Requires explicit server implementations
- Not designed for group chat or multi-agent orchestration

**Next.js Integration Example:**
```javascript
// Node.js backend (API route)
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["mcp-server-filesystem.js"],
});
const client = new Client({ name: "agent", version: "1.0" });
await client.connect(transport);
const tools = await client.listTools();
// Expose tools to frontend via REST API
```

---

## 3. OPENCLAW / AGENT COMMUNICATION PROTOCOL (ACP)

### What It Is
OpenClaw: Open-source agent framework for coordinating multiple AI agents.
ACP (Agent Communication Protocol): Structured stdio-based protocol for agent-to-agent & human-to-agent communication within OpenClaw.

**Key Facts:**
- OpenClaw originally ClawdBot/MoltBot
- ACP is its orchestration layer
- Enables IDE-to-agent bridges (e.g., Claude Code, Cursor, Codex)

### Agent-to-Human & Agent-to-Agent
- **A2H:** ACP client (human/IDE) sends tasks → ACP server processes & returns results.
- **A2A:** Native. Main orchestrator agent delegates to sub-agents via ACP. Supports task delegation, result aggregation, cooperative workflows.
- **Protocol:** JSON over stdio (standard input/output), supports soft-close lifecycle, prompt queuing

### Group Conversations
✅ **Yes.** ACP supports parallel sub-agent execution and multi-agent teams.

### SDKs & Libraries
- **Python:** Official SDK with persistent session support
- **Go:** acpx (headless CLI client)
- **Backports:** Node.js via child_process, but not officially maintained
- **IDE plugins:** Claude Code, Cursor, Codex integrations available

### Maturity & Status
- **Active.** Community-driven, gaining traction in agent teams.
- Strong adoption in developer tools (Cursor, Claude Code).
- Not backed by major corp but growing ecosystem.

### Use in Next.js Chat/Playground
**Integration path:**
```
Next.js frontend → Node.js ACP client → OpenClaw orchestrator → sub-agents
```

**For agent team workspaces:**
```
Playground UI → Web socket → Node.js ACP gateway → manage teams/sessions
```

**Pros:**
- Native multi-agent orchestration
- Persistent sessions (reconnect to same conversation)
- Lightweight (stdio = low overhead)
- IDE integration patterns proven

**Cons:**
- Smaller ecosystem than A2A or MCP
- Node.js support unofficial (Python/Go primary)
- Learning curve for ACP protocol specifics

**Node.js Example** (unofficial):
```javascript
// Spawn ACP session as child process
const { spawn } = require("child_process");
const acp = spawn("python3", ["openclaw-acp-server.py"]);
acp.stdin.write(JSON.stringify({ type: "task", payload: {...} }));
acp.stdout.on("data", (data) => {
  // Handle ACP response
});
```

---

## 4. AGENT PROTOCOL (AgentProtocol.ai)

### What It Is
Tech-agnostic, OpenAPI-based specification for agent communication. Maintained by AGI, Inc., originally developed by AI Engineer Foundation. Aims to be universal language for agent APIs.

**Key Stat:** Defined as OpenAPI specification → language-agnostic, easy to implement.

### Agent-to-Human & Agent-to-Agent
- **A2H:** HTTP REST endpoints. Human/client calls agent endpoints to execute tasks, poll status, get results.
- **A2A:** Via REST calls. One agent can invoke another's HTTP endpoints.
- **Protocol:** HTTP REST + JSON (OpenAPI v3)

### Group Conversations
❓ **Unclear from spec.** REST-based design suggests HTTP connections, but no explicit group chat specification found.

### SDKs & Libraries
- **SDKs:** Multiple languages via OpenAPI code generation
- **Framework integrations:** AutoGPT, Agent-Zero, frameworks adopting OpenAPI compliance
- **Spec-only:** Focus on standard over full SDK ecosystem

### Maturity & Status
- **Emerging.** Solid standard, but less adoption than A2A or MCP (Dec 2025).
- Lightweight adoption barrier (just REST endpoints).
- Growing interest in standardization community.

### Use in Next.js Chat/Playground
**Integration path:**
```
Next.js frontend → REST API calls → Agent Protocol endpoints
```

**Perfect for:** Simple agent as REST service

**Pros:**
- Simplest integration (just REST)
- Language-agnostic (OpenAPI)
- Stateless (easier to scale)
- Low setup overhead

**Cons:**
- Emerging standard (less mature)
- REST may not fit real-time chat UX (polling vs. streaming)
- No built-in group chat
- Fewer ready-made SDKs vs. A2A/MCP

**Next.js Example:**
```javascript
// Frontend component
const agentResponse = await fetch("/api/agents/claude/execute", {
  method: "POST",
  body: JSON.stringify({ task: "analyze this code" }),
});
const result = await agentResponse.json();
// result = { status: "completed", output: "..." }
```

---

## 5. GOCLAW

### What It Is
Enterprise AI agent gateway written in Go. Multi-tenant, 11+ LLM provider support, 5 messaging channels (Discord, Slack, Zalo, custom bridge, Matrix).

**Key Facts:**
- Single Go binary, lightweight, fast startup
- PostgreSQL for persistence
- 5-layer security architecture
- Channel-agent mapping: each channel instance → specific agent

### Agent-to-Human & Agent-to-Agent
- **A2H:** Via 5 channels (Discord, Slack, Zalo, custom bridge, Matrix).
- **A2A:** Can route between agents via channel. Limited native support for agent-to-agent; primarily channel router.
- **Protocols:** Discord (DiscordGo), Slack (Slack Go SDK), Zalo (WebSocket + JSON), Custom (WebSocket + JSON), Matrix (Matrix-Rust SDK)

### Group Conversations
✅ **Yes.** Works with group chats on Discord, Slack, Matrix. Each channel instance can address groups.

### SDKs & Libraries
- **Go SDK:** Official
- **REST API:** HTTP endpoints for agent management
- **Channel libraries:** Discord Go, Slack Go, Zalo WebSocket, Matrix Rust SDK

### Maturity & Status
- **Stable.** Production-ready, enterprise-grade.
- Single binary, low deployment friction.
- Active development; multi-tenant features mature.

### Use in Next.js Chat/Playground
**Integration path (best for multi-channel):**
```
Next.js frontend → WebSocket → GoClaw gateway → 5 channels
                                              → Discord/Slack/Zalo/Matrix/custom agents
```

**For chat playground + external channel distribution:**
```
Playground UI → WebSocket to custom bridge → GoClaw → agents
```

**Pros:**
- 5 channels out-of-box (Discord, Slack, Zalo, Matrix, custom)
- Single binary deployment
- Multi-tenant architecture
- High security (5-layer)
- Enterprise-ready

**Cons:**
- Not agent-specific protocol (gateway tool)
- Custom bridge has 512KB message limit, 1MB HTTP body
- Primarily for channel routing, not orchestration
- Go binary (not JavaScript ecosystem)

**Custom Bridge Example:**
```javascript
// Next.js WebSocket client to GoClaw
const ws = new WebSocket("ws://goclaw:8080/bridge");
ws.send(JSON.stringify({
  type: "message",
  agent: "my-agent",
  content: "hello",
  channel: "playground", // custom channel instance
  isDm: false, // or true for DM
}));
ws.onmessage = (event) => {
  const result = JSON.parse(event.data);
  console.log(result.content);
};
```

---

## 6. MATRIX PROTOCOL

### What It Is
Open standard for real-time communication (instant messaging, VoIP, video). Decentralized, federated, supports bots and agent integrations via bridges and plugins.

**Key Facts:**
- Not AI-specific; general messaging
- Federated (any server can interoperate)
- matrix-bot-sdk (TypeScript) for building bots
- Self-hosted or managed servers available

### Agent-to-Human & Agent-to-Agent
- **A2H:** Matrix bot sends/receives messages in room. Human chats with bot.
- **A2A:** Via bridge bots or relay bots. Agents communicate by posting to shared rooms.
- **Protocol:** HTTP + WebSocket (Matrix Client-Server API)

### Group Conversations
✅ **Yes.** Matrix rooms (chat groups) are native. Bots participate in group chats natively.

### SDKs & Libraries
- **TypeScript/JS:** matrix-bot-sdk, matrix-js-sdk
- **Python:** matrix-client-py
- **Rust:** matrix-sdk
- **Integrations:** OpenClaw has Matrix channel support

### Maturity & Status
- **Stable.** RFC 3100+ defines core protocol. Production deployments at scale.
- Younger than traditional IM (founded 2014) but mature as of 2026.
- Growing interest in decentralized infra.

### Use in Next.js Chat/Playground
**Integration path (federated or self-hosted):**
```
Next.js frontend → Matrix client SDK → Matrix homeserver → bots/agents
```

**For playground + external groups:**
```
Playground UI → Matrix room → agents + humans
```

**Pros:**
- Decentralized (self-hosted or federated)
- Native group chat support
- Multiple SDKs (TypeScript, Python, Rust)
- Proven at scale

**Cons:**
- Not AI-specific (requires bot abstraction layer)
- Setup more complex than REST-based protocols
- Scaling requires homeserver infrastructure
- Learning curve for federated concepts

**TypeScript Example:**
```javascript
import { MatrixClient, SimpleFsStorageProvider, AutojoinRoomsMixin } from "matrix-bot-sdk";

const client = new MatrixClient("https://matrix.org", "@bot:matrix.org", "syt_token");
const storage = new SimpleFsStorageProvider(".matrix-storage");
client.setStorageProvider(storage);

AutojoinRoomsMixin.setupOnClient(client);

client.on("room.message", (roomId, event) => {
  if (event.content.body.includes("@bot")) {
    client.sendMessage(roomId, {
      msgtype: "m.text",
      body: "I am an AI agent!",
    });
  }
});

client.start();
```

---

## 7. XMPP (EXTENSIBLE MESSAGING & PRESENCE PROTOCOL)

### What It Is
Legacy open standard for instant messaging (since 2004, RFC 3920/3921). XML-based, extensible via XEPs (XMPP Extension Protocols).

**Key Facts:**
- Mature, proven infrastructure (Jabber)
- Agent support via XEP-0094 (deprecated) → XEP-0030 (Service Discovery)
- Jingle extension for peer-to-peer communication

### Agent-to-Human & Agent-to-Agent
- **A2H:** Agent as JID (XMPP user). Human sends stanzas (messages) to agent JID.
- **A2A:** Via service discovery or direct JID communication.
- **Protocol:** XML over TCP/TLS

### Group Conversations
✅ **Yes.** XEP-0045 (Multi-User Chat) supports group messaging.

### SDKs & Libraries
- **JavaScript/Node.js:** strophe.js, xmpp.js
- **Python:** sleekxmpp, slixmpp
- **Mature ecosystem** but less active for new projects

### Maturity & Status
- **Legacy/Stable.** Production-proven but declined adoption for new projects.
- Industry moved to REST/WebSocket for web apps.
- Still used in enterprise (secure messaging).

### Use in Next.js Chat/Playground
**Integration path (not recommended for new projects):**
```
Next.js frontend → WebSocket → XMPP server → agents
```

**Pros:**
- Mature, proven infrastructure
- Decentralized/federated (like Matrix)
- Enterprise security heritage

**Cons:**
- XML verbose vs. JSON (larger payloads)
- Older SDKs, less community activity
- Learning curve steep
- Not suitable for modern real-time web apps
- Agent support deprecated (XEP-0094)

---

## COMPARATIVE MATRIX

| Criterion | A2A | MCP | OpenClaw/ACP | Agent Protocol | GoClaw | Matrix | XMPP |
|-----------|-----|-----|--------------|----------------|--------|--------|------|
| **Purpose** | Agent interop | Tool/context | Orchestration | Universal API | Gateway | Messaging | Messaging |
| **A2H Support** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **A2A Support** | ✅ | ⚠️ Limited | ✅ | ✅ | ⚠️ Limited | ⚠️ Via bots | ⚠️ Via agents |
| **Groups** | ✅ | ❌ | ✅ | ❓ | ✅ | ✅ | ✅ |
| **Protocol** | HTTPS+JSON-RPC | JSON-RPC | stdio+JSON | REST+JSON | WebSocket+JSON | HTTP+WS | XML+TCP |
| **Node.js SDK** | ✅ | ✅ | ⚠️ Unofficial | ✅ | ❌ (REST only) | ✅ | ✅ |
| **Maturity** | Stable v0.3 | Stable | Active | Emerging | Stable | Stable | Legacy |
| **Ecosystem** | 150+ orgs | 1000+ servers | Growing | Emerging | Production | Proven | Declining |
| **Self-hosted** | ❌ (vendor) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Setup Complexity** | Medium | Low | Medium | Low | Low | Medium | High |
| **For Chat App** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐ |

---

## RECOMMENDATIONS FOR NEXT.JS CHAT/PLAYGROUND

### Use Case 1: Simple Chatbot + Tool Access
**Stack:** Next.js + MCP + Vercel AI SDK
```
Frontend → /api/chat → MCP client → tools → LLM → response
```
**Why:** MCP is industry standard, easy setup, perfect for tool integration.

---

### Use Case 2: Multi-Agent Orchestration (Team Workspace)
**Stack:** Next.js + A2A + Node.js gateway
```
Frontend → /api/agents → A2A client → remote agents (delegating)
```
**Why:** A2A is enterprise-grade, 150+ partners, native delegation support.

---

### Use Case 3: Chat App + Multiple External Channels
**Stack:** Next.js + GoClaw + WebSocket bridge
```
Playground UI → /api/bridge → GoClaw → Discord/Slack/Zalo/Matrix
```
**Why:** GoClaw handles 5 channels out-of-box, single binary, scalable.

---

### Use Case 4: Decentralized, Self-Hosted Chat + Bots
**Stack:** Next.js + Matrix + matrix-bot-sdk
```
Frontend → Matrix SDK → Matrix homeserver → bots + groups
```
**Why:** Federated, self-hosted, native group support, mature.

---

### Use Case 5: IDE-Driven Agent Team (Developer Tools)
**Stack:** Next.js + OpenClaw ACP + Python orchestrator
```
Frontend → ACP client → OpenClaw → sub-agents
```
**Why:** ACP native multi-agent, persistent sessions, IDE patterns.

---

## ARCHITECTURE PATTERNS

### Pattern A: REST Gateway to Agents
```
Next.js → REST routes (/api/agents) → A2A/MCP client → remote services
```
**Best for:** Stateless, cloud-native, quick scaling.
**Protocols:** Agent Protocol, REST-wrapped A2A/MCP.

---

### Pattern B: WebSocket Gateway
```
Next.js → WebSocket server (/ws) → agent gateway (GoClaw/OpenClaw) → agents
```
**Best for:** Real-time, multi-channel, team collaboration.
**Protocols:** GoClaw, OpenClaw ACP, custom bridges.

---

### Pattern C: Direct MCP Integration (Simplest)
```
Next.js API route → MCP client (stdio/SSE) → MCP servers
```
**Best for:** Single-agent tool access, minimal setup.
**Protocols:** MCP only.

---

## UNRESOLVED QUESTIONS

1. **Agent Protocol maturity:** No real-world enterprise deployments found. How quickly will it gain adoption vs. A2A's 150 orgs?

2. **OpenClaw Node.js:** Is there official Node.js support coming for ACP, or should I stick with Python/Go backends?

3. **A2A security:** How are Agent Cards validated? HTTPS + auth sufficient for multi-tenant?

4. **MCP A2A interop:** Anthropic claimed MCP + A2A work together. Are there example implementations (Dec 2025)?

5. **GoClaw scaling:** 512KB message limit in custom bridge—is this hard ceiling or configurable?

6. **Matrix federation:** Cost/complexity of running homeserver vs. using managed Matrix service (Beeper, etc.)?

7. **Group DM handling:** Which protocols best handle group DMs vs. group channels? A2A, Matrix clear; MCP unclear.

---

## SOURCES

- [Announcing the Agent2Agent Protocol (A2A) - Google Developers Blog](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)
- [What Is Agent2Agent (A2A) Protocol? | IBM](https://www.ibm.com/think/topics/agent2agent-protocol)
- [Linux Foundation Launches the Agent2Agent Protocol Project](https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents)
- [GitHub - a2aproject/A2A](https://github.com/a2aproject/A2A)
- [Introducing the Model Context Protocol - Anthropic](https://www.anthropic.com/news/model-context-protocol)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/specification/2025-11-25)
- [What is Model Context Protocol (MCP)? | IBM](https://www.ibm.com/think/topics/model-context-protocol)
- [ACP Agents - OpenClaw](https://docs.openclaw.ai/tools/acp-agents)
- [How OpenClaw Works: Understanding AI Agents | Medium](https://bibek-poudel.medium.com/how-openclaw-works-understanding-ai-agents-through-a-real-architecture-5d59cc7a4764)
- [Welcome - Agent Communication Protocol](https://agentcommunicationprotocol.dev/introduction/welcome)
- [Home - AgentProtocol.ai](https://agentprotocol.ai/)
- [MCP, A2A, ACP: What does it all mean? | Akka Blog](https://akka.io/blog/mcp-a2a-acp-what-does-it-all-mean)
- [GitHub - nextlevelbuilder/goclaw](https://github.com/nextlevelbuilder/goclaw)
- [GoClaw — Enterprise AI Agent Platform](https://goclaw.sh/)
- [Matrix (protocol) - Wikipedia](https://en.wikipedia.org/wiki/Matrix_(protocol))
- [Matrix.org - Usage of matrix-bot-sdk](https://matrix.org/docs/older/matrix-bot-sdk-intro/)
- [OpenClaw Matrix Channel Integration](https://docs.openclaw.ai/channels/matrix)
- [Specifications | XMPP - The universal messaging standard](https://xmpp.org/extensions/)
- [AI Agent Protocols 2026: The Complete Guide | Ruh.ai](https://www.ruh.ai/blogs/ai-agent-protocols-2026-complete-guide)
- [A Year of MCP: From Internal Experiment to Industry Standard | Pento](https://www.pento.ai/blog/a-year-of-mcp-2025-review)
- [Agentic AI Foundation: Guide to Open Standards](https://intuitionlabs.ai/articles/agentic-ai-foundation-open-standards)
- [GitHub - punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers)
- [GitHub - modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)
- [Adding AI Chat Features to a Modern Next.js Application | GetStream](https://getstream.io/blog/ai-chat-nextjs/)
- [Building Chatbox UI on Next.js using Vercel AI SDK | Medium](https://juniarto-samsudin.medium.com/building-chatbox-ui-on-next-js-using-vercel-ai-sdk-part-1-86cec0889bf4)
- [OpenAI co-founds the Agentic AI Foundation | OpenAI](https://openai.com/index/agentic-ai-foundation/)
