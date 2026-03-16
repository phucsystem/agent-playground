# Agent Protocol Implementation Guidance for Next.js Chat/Playground

**Date:** March 16, 2026

---

## QUICK DECISION TREE

```
Is this for...?

┌─ Simple chatbot + tools?
│  └─ → Use MCP (industry standard, easiest)
│
├─ Multi-agent team orchestration?
│  └─ → Use A2A (enterprise, 150+ orgs)
│
├─ Chat app + Discord/Slack/Zalo distribution?
│  └─ → Use GoClaw (5 channels, single binary)
│
├─ Self-hosted decentralized chat?
│  └─ → Use Matrix (federated, mature)
│
└─ IDE-driven agent teams (developer tools)?
   └─ → Use OpenClaw ACP (persistent sessions, delegation)
```

---

## RECOMMENDED STACKS FOR NEXT.JS

### Stack 1: Minimal (Best for Playground MVP)
**MCP-only for tool access**
```
Technology: Next.js 15 + Node.js MCP client + Vercel AI SDK
Time to MVP: 2-3 days
Complexity: Low
Scaling: Local first, scales via API route → cloud MCP servers
```

**Setup:**
1. Add MCP server (filesystem, git, API integration)
2. Create `/api/chat` endpoint with MCP client
3. Connect Vercel AI SDK to route
4. Frontend calls `useChat()` hook

**Code skeleton:**
```typescript
// lib/mcp-client.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export async function getMCPTools() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["./mcp-servers/filesystem.js"],
  });
  const client = new Client({ name: "playground", version: "1.0" });
  await client.connect(transport);
  return client.listTools();
}

// app/api/chat/route.ts
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const tools = await getMCPTools();

  const { text } = await generateText({
    model: openai("gpt-4"),
    messages,
    tools: tools, // MCP tools exposed
    maxSteps: 5,
  });

  return Response.json({ content: text });
}
```

**Trade-offs:**
- ✅ Simplest integration
- ✅ Standard tool access
- ❌ Single-agent only (no multi-agent orchestration)
- ❌ Local MCP servers only (unless you wrap in REST)

---

### Stack 2: Multi-Channel Distribution (Best for Scaling)
**GoClaw gateway for 5 channels**
```
Technology: Next.js 15 + GoClaw (Go binary) + WebSocket bridge
Time to MVP: 3-5 days (GoClaw deployment) + 2 days (Next.js integration)
Complexity: Medium
Scaling: GoClaw handles 5 channels, PostgreSQL persistence
```

**Setup:**
1. Deploy GoClaw binary (PostgreSQL backend)
2. Register agents in GoClaw (Claude, GPT-4, custom)
3. Create WebSocket `/api/ws` endpoint in Next.js
4. Forward messages to GoClaw custom bridge
5. Route agent responses back to frontend

**Architecture diagram:**
```
Playground UI
    ↓ WebSocket
Next.js /api/ws
    ↓ WebSocket/JSON
GoClaw Gateway (Go binary)
    ├─ Discord channel
    ├─ Slack channel
    ├─ Zalo channel
    ├─ Matrix channel
    └─ Custom bridge (playground)
    ↓
Agents (Claude, GPT-4, local)
```

**Code skeleton:**
```typescript
// lib/goclaw-client.ts
export class GoClawClient {
  ws: WebSocket;

  constructor(url: string) {
    this.ws = new WebSocket(url);
  }

  send(agentId: string, content: string, isDm: boolean = true) {
    this.ws.send(JSON.stringify({
      type: "message",
      agent: agentId,
      content,
      channel: "playground",
      isDm,
      timestamp: Date.now(),
    }));
  }

  onMessage(callback: (msg: any) => void) {
    this.ws.onmessage = (event) => {
      callback(JSON.parse(event.data));
    };
  }
}

// app/api/ws/route.ts (using Next.js WebSocket support)
import { NextRequest } from "next/server";
import { WebSocketServer } from "ws";

const goclaw = new GoClawClient("ws://goclaw:8080/bridge");

export async function GET(req: NextRequest) {
  const { socket, headers } = Bun.upgrade(req); // or ws library
  socket.onmessage = (event) => {
    const { agentId, content } = JSON.parse(event.data);
    goclaw.send(agentId, content);
  };
  goclaw.onMessage((msg) => {
    socket.send(JSON.stringify(msg));
  });
}
```

**Trade-offs:**
- ✅ 5 channels out-of-box (Discord, Slack, Zalo, Matrix, custom)
- ✅ Single binary deployment
- ✅ Multi-tenant support
- ✅ Enterprise security (5-layer)
- ❌ Requires Go binary + PostgreSQL
- ❌ Not agent-specific (gateway tool, not orchestration)

---

### Stack 3: Multi-Agent Orchestration (Best for Team Workspace)
**A2A protocol with Node.js gateway**
```
Technology: Next.js 15 + A2A SDK + Node.js backend gateway
Time to MVP: 5-7 days (A2A integration) + 2 days (Next.js)
Complexity: High
Scaling: A2A handles agent delegation, supports 150+ org ecosystem
```

**Setup:**
1. Implement A2A client in Node.js backend
2. Define Agent Cards (JSON schema of agent capabilities)
3. Create `/api/agents` endpoint exposing agent selection
4. Frontend requests task → gateway routes to best agent via A2A
5. Results aggregated and sent back

**Architecture diagram:**
```
Playground UI (list agents, select task)
    ↓ HTTP/REST
Next.js /api/agents
    ↓ A2A protocol (HTTPS + JSON-RPC)
Primary Agent (orchestrator)
    ├─ Requests agent discovery
    ├─ Selects best remote agent for task type
    └─ Receives results
    ↓
Remote Agents (Claude, Copilot, custom)
    (Listed via Agent Cards)
```

**Code skeleton:**
```typescript
// lib/a2a-client.ts
import { A2AClient } from "@a2aproject/sdk"; // hypothetical

export const a2aClient = new A2AClient({
  clientId: "playground-primary",
  credentials: process.env.A2A_CREDENTIALS,
  remoteAgentRegistry: process.env.A2A_REGISTRY_URL,
});

export async function listAgents() {
  // Query agent card registry
  return a2aClient.discoverAgents({
    capabilities: ["reasoning", "coding", "analysis"],
  });
}

export async function delegateTask(agentId: string, task: string) {
  const response = await a2aClient.sendRequest({
    remoteAgentId: agentId,
    task: {
      type: "prompt",
      content: task,
      modality: "text",
    },
  });
  return response.result;
}

// app/api/agents/route.ts
export async function GET() {
  const agents = await listAgents();
  return Response.json({ agents });
}

export async function POST(req: Request) {
  const { agentId, task } = await req.json();
  const result = await delegateTask(agentId, task);
  return Response.json({ result });
}
```

**Trade-offs:**
- ✅ Native agent delegation (one agent calls another)
- ✅ 150+ org ecosystem, enterprise support
- ✅ Multi-modal (text, audio, video)
- ✅ Team-based orchestration
- ❌ Requires backend gateway
- ❌ Overkill for simple chatbot
- ❌ More complex than MCP

---

### Stack 4: Decentralized Self-Hosted (Best for Privacy)
**Matrix protocol + self-hosted homeserver**
```
Technology: Next.js 15 + matrix-bot-sdk + Matrix homeserver
Time to MVP: 4-6 days (homeserver setup) + 2 days (Next.js)
Complexity: Medium-High
Scaling: Federated (any homeserver can interop), self-hosted
```

**Setup:**
1. Deploy Matrix homeserver (Synapse, Conduit, Dendrite)
2. Register bot user on homeserver
3. Create room for playground
4. Use matrix-bot-sdk in Next.js (SSR) or separate Node.js service
5. Frontend → Matrix SDK → homeserver → bot

**Architecture diagram:**
```
Playground UI
    ↓ Matrix Client SDK
Matrix Homeserver (self-hosted or managed)
    ├─ Playground room (agents + humans)
    └─ Agent bots (matrix-bot-sdk)
    ↓
Remote Matrix servers (optional federation)
```

**Code skeleton:**
```typescript
// lib/matrix-bot.ts
import { MatrixClient, SimpleFsStorageProvider, AutojoinRoomsMixin } from "matrix-bot-sdk";

const client = new MatrixClient(
  process.env.MATRIX_HOMESERVER_URL,
  process.env.MATRIX_BOT_USER_ID,
  process.env.MATRIX_BOT_ACCESS_TOKEN,
);

const storage = new SimpleFsStorageProvider(".matrix-storage");
client.setStorageProvider(storage);
AutojoinRoomsMixin.setupOnClient(client);

client.on("room.message", async (roomId, event) => {
  if (!event.content.body) return;
  if (event.sender === (await client.getUserId())) return; // ignore own messages

  // Process message, call LLM, respond
  const response = await callAgent(event.content.body);
  await client.sendMessage(roomId, {
    msgtype: "m.text",
    body: response,
  });
});

export async function startMatrixBot() {
  await client.start();
}

// app/api/matrix/route.ts (optional REST proxy)
export async function POST(req: Request) {
  const { roomId, message } = await req.json();
  await client.sendMessage(roomId, {
    msgtype: "m.text",
    body: message,
  });
  return Response.json({ sent: true });
}
```

**Trade-offs:**
- ✅ Decentralized / self-hosted
- ✅ Native group chat support
- ✅ Federated (interop with other Matrix servers)
- ✅ Privacy-focused
- ❌ Infrastructure overhead (homeserver)
- ❌ More complex setup than REST-based
- ❌ Not AI-specific (bot abstraction needed)

---

### Stack 5: Hybrid (Best for Everything)
**MCP + A2A + Matrix**
```
Technology: Next.js 15 + MCP + A2A SDK + Matrix bot
Time to MVP: 10-14 days
Complexity: Very High
Scaling: Best of all worlds
```

**Use:**
- MCP for single-agent tool access (file, git, APIs)
- A2A for multi-agent delegation (team workspace)
- Matrix for decentralized chat + external distribution

**Architecture:**
```
Playground UI
    ├─ MCP tools (read files, query DB)
    ├─ A2A agents (team orchestration)
    └─ Matrix room (decentralized chat)
    ↓
Next.js backend
    ├─ MCP client → local/remote tools
    ├─ A2A client → agent registry
    └─ Matrix bot SDK → homeserver
    ↓
Agents + Tools + Matrix servers
```

**Trade-offs:**
- ✅ Covers all use cases
- ❌ Highest complexity
- ❌ Longest development time
- ❌ Most moving parts to maintain

---

## PROTOCOL COMPARISON FOR IMPLEMENTATION

| Factor | MCP | A2A | GoClaw | Matrix | OpenClaw |
|--------|-----|-----|--------|--------|----------|
| **Setup time** | 1-2 days | 5-7 days | 3-5 days | 4-6 days | 5-7 days |
| **Node.js SDK** | Official | Official | REST only | Official | Unofficial |
| **MVP readiness** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **Scaling ease** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Multi-agent** | ❌ | ✅ | ⚠️ | ⚠️ | ✅ |
| **Tool/context** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Multiple channels** | ❌ | ❌ | ✅ | ✅ | ⚠️ |
| **Deployment** | Local/Cloud | Cloud | On-prem | On-prem/Cloud | On-prem |
| **Infrastructure** | None | None | Go binary + DB | Homeserver | Python service |

---

## INSTANT IMPLEMENTATION CHECKLIST

### For MCP (Recommended MVP)
- [ ] Choose MCP server type (filesystem, git, API wrapper)
- [ ] Install `@modelcontextprotocol/sdk`
- [ ] Create `/api/chat` route
- [ ] Connect to Vercel AI SDK
- [ ] Test with Playground UI
- [ ] Add tool schemas to frontend
- [ ] Deploy to Vercel

**Estimated: 2-3 days**

---

### For GoClaw (Best for Multi-Channel)
- [ ] Deploy GoClaw (Docker or binary)
- [ ] Set up PostgreSQL
- [ ] Register agents in GoClaw UI
- [ ] Create `/api/ws` WebSocket route
- [ ] Implement GoClaw client wrapper
- [ ] Connect Playground UI to WebSocket
- [ ] Test Discord/Slack integration (optional)

**Estimated: 5-7 days**

---

### For A2A (Best for Multi-Agent Teams)
- [ ] Get A2A credentials from registry
- [ ] Install A2A SDK
- [ ] Define Agent Cards (JSON schema)
- [ ] Create `/api/agents` endpoint
- [ ] Implement agent discovery logic
- [ ] Add delegation request handler
- [ ] Connect Playground UI to agent list
- [ ] Test task routing

**Estimated: 7-10 days**

---

## KNOWN GOTCHAS

1. **MCP stdio overhead:** Each MCP connection spawns process. For high-concurrency, wrap in REST gateway.

2. **A2A latency:** Agent discovery + task routing adds 200-500ms. Acceptable for most use cases, not real-time.

3. **GoClaw message size:** 512KB limit on custom bridge. Chunk large responses.

4. **Matrix server:** Default Synapse is resource-heavy (RAM). Consider Conduit (Rust) or managed service (Beeper).

5. **OpenClaw Node.js:** Official support TBD. Python/Go preferred for now.

---

## RECOMMENDED: MCP FIRST, THEN A2A

**Rationale:**
- MCP is industry standard (fastest to MVP)
- Proven production use (1000+ servers)
- Easy to add A2A later via node wrapping
- Start simple, scale complex

**Migration path:**
```
Day 1-3:   MCP MVP (chatbot + tools)
    ↓
Day 4-7:   Add A2A wrapper (multi-agent)
    ↓
Day 8-10:  Add GoClaw bridge (multi-channel)
```

---
