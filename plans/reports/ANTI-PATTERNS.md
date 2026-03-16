# Agent Protocol Anti-Patterns: What NOT to Do

**Date:** March 16, 2026
**Purpose:** Common mistakes when integrating agent protocols into chat/playground apps

---

## ANTI-PATTERN 1: Hybrid Stacks From Day 1

### The Mistake
```javascript
// DON'T DO THIS on Day 1:
// "Let's use MCP + A2A + Matrix + GoClaw simultaneously"
```

### Why It Fails
- 4+ protocols = 4+ separate deployments, codebases, failure modes
- Debugging nightmare: which layer is broken?
- Team loses focus; takes 10-14 days instead of 3
- "Boil the ocean" approach; MVP never ships

### What To Do Instead
```
Week 1:  MCP only (fast MVP)
Week 2:  Evaluate if A2A needed? (single-agent enough? stop here)
Week 3:  Add A2A if required (multi-agent delegation)
Week 4:  Add GoClaw/Matrix only if you need those specific features
```

**Result:** Ship Week 1, scale Week 3-4, not "everything at once"

---

## ANTI-PATTERN 2: Trying to Use XMPP in 2026

### The Mistake
```javascript
// DON'T DO THIS:
// "Let's use XMPP because we're used to it"
```

### Why It Fails
- XMPP agent support deprecated (XEP-0094 → XEP-0030)
- XML verbose vs. JSON (larger payloads, slower)
- Smaller community, fewer SDKs
- Learning curve steep with no modern payoff
- Industry moved on to REST/WebSocket (2010s) and now gRPC (2025+)

### What To Do Instead
- Use **Matrix** if you want decentralized messaging (like XMPP but modern)
- Use **MCP** if you want tool access (agent-centric)
- Use **A2A** if you want agent interop (agent-centric)

**Verdict:** XMPP is legacy. Don't start new projects with it.

---

## ANTI-PATTERN 3: Implementing Agent Protocol as Primary

### The Mistake
```javascript
// DON'T DO THIS:
// "Let's standardize on Agent Protocol for everything"
```

### Why It Fails
- Agent Protocol is emerging, not production-proven (Dec 2025)
- <10 real-world enterprise deployments found
- REST-only (not real-time friendly)
- Limited SDK ecosystem vs. MCP/A2A
- No native group or orchestration support

### What To Do Instead
- Use **Agent Protocol** ONLY if you need lightweight REST endpoints
- For everything else: **MCP** (tools), **A2A** (orchestration), **Matrix** (messaging)

**Verdict:** Agent Protocol promising but unproven. Not recommended for MVP.

---

## ANTI-PATTERN 4: Running MCP Servers Per Request

### The Mistake
```javascript
// WRONG: Spawn new MCP server per API request
app.post("/api/chat", async (req, res) => {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["mcp-filesystem.js"],
  });
  const client = new Client();
  await client.connect(transport);  // ← This happens EVERY request
  // Use client...
  await client.disconnect();
});
```

### Why It Fails
- Spawns child process for every chat message
- Process overhead: 50-200ms per spawn
- File descriptor leaks if not cleaned up properly
- Load test: 100 concurrent = 100+ child processes

### What To Do Instead
```javascript
// RIGHT: Reuse single MCP client connection
let client = null;

async function initMCPClient() {
  if (client) return client;
  const transport = new StdioClientTransport({
    command: "node",
    args: ["mcp-filesystem.js"],
  });
  client = new Client();
  await client.connect(transport);
  return client;
}

app.post("/api/chat", async (req, res) => {
  const mcp = await initMCPClient();
  const tools = await mcp.listTools();
  // Use mcp...
});
```

**Or:** Wrap in REST gateway for connection pooling
```javascript
// MCP REST Gateway (reusable connection)
// App → /api/tools (REST) → MCP client (pooled) → tools
```

---

## ANTI-PATTERN 5: Not Chunking Large Messages in GoClaw

### The Mistake
```javascript
// WRONG: Send 5MB response to GoClaw custom bridge
goclaw.send("my-agent", largeJsonResponse); // 512KB limit!
```

### Why It Fails
- GoClaw custom bridge has 512KB message limit
- Large responses silently dropped or fail
- User sees nothing (timeout)
- No error handling in bridge

### What To Do Instead
```javascript
// RIGHT: Chunk at 500KB boundary
function chunkMessage(msg, chunkSize = 500 * 1024) {
  const chunks = [];
  for (let i = 0; i < msg.length; i += chunkSize) {
    chunks.push(msg.slice(i, i + chunkSize));
  }
  return chunks;
}

const response = generateLargeResponse();
const chunks = chunkMessage(response);
for (const chunk of chunks) {
  goclaw.send("my-agent", chunk);
}
```

---

## ANTI-PATTERN 6: Ignoring A2A Latency

### The Mistake
```javascript
// WRONG: Expect <100ms response from A2A agent delegation
const result = await a2aClient.delegateTask(agentId, task);
console.log(result); // Blocking, waiting...
```

### Why It Fails
- A2A involves: agent discovery (50ms) + task routing (50ms) + remote execution (100-1000ms)
- Total latency: 200-1500ms minimum
- If you expect real-time chat (<500ms), A2A won't work

### What To Do Instead
```javascript
// RIGHT: Use async/streaming for A2A
const taskId = await a2aClient.submitTask(agentId, task);
// Poll or webhook for result
app.get("/api/task/:id", async (req, res) => {
  const result = await a2aClient.getTaskResult(req.params.id);
  res.json(result);
});
```

Or use **MCP instead** if you need <500ms response times (local tools).

---

## ANTI-PATTERN 7: No Error Handling for Protocol Failures

### The Mistake
```javascript
// WRONG: Assume protocols never fail
app.post("/api/chat", async (req, res) => {
  const tools = await mcp.listTools();  // What if MCP server crashes?
  const result = await a2aClient.delegateTask(...);  // What if registry down?
  const matrix = await matrixClient.sendMessage(...);  // What if homeserver down?
  res.json({ success: true });
});
```

### Why It Fails
- MCP stdio crash = child process zombie
- A2A registry down = agent discovery fails (entire team blocked)
- Matrix homeserver down = all group chats fail
- No fallback = poor UX

### What To Do Instead
```javascript
// RIGHT: Graceful degradation
app.post("/api/chat", async (req, res) => {
  try {
    const tools = await mcp.listTools();
    // Use tools
  } catch (err) {
    console.error("MCP unavailable:", err);
    return res.json({
      success: false,
      error: "Tools temporarily unavailable",
      fallback: "Chat without tools"
    });
  }

  try {
    const result = await a2aClient.delegateTask(...);
  } catch (err) {
    console.error("A2A unavailable:", err);
    // Fallback to local agent
    return res.json({
      success: false,
      error: "Agent team unavailable",
      fallback: "Using local agent"
    });
  }
});
```

---

## ANTI-PATTERN 8: Exposing MCP Over Untrusted Networks

### The Mistake
```javascript
// WRONG: Expose MCP directly to internet
const transport = new HttpTransport({
  url: "http://mcp-server.internal:8000",  // No auth!
});
// Anyone can call MCP tools (file read, execute commands)
```

### Why It Fails
- MCP gives LLM access to files, git, APIs, commands
- Direct exposure = data breach, code theft, system compromise
- No auth by default = public vulnerability

### What To Do Instead
```javascript
// RIGHT: MCP behind authenticated gateway
// Topology:
// Internet → Next.js API (auth required) → MCP client (internal only)

// In Next.js API route:
app.post("/api/chat", async (req, res) => {
  // 1. Verify user JWT
  if (!verifyToken(req.headers.authorization)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // 2. Call MCP (internal, not exposed)
  const client = await initMCPClient();
  const tools = await client.listTools();

  // 3. LLM uses tools on behalf of authenticated user
  // (no direct MCP exposure)
});
```

---

## ANTI-PATTERN 9: Not Planning for Multi-Tenancy

### The Mistake
```javascript
// WRONG: Single-tenant implementation
const goclaw = new GoClawClient("ws://goclaw:8080");
// All users share same agent instance
// User A sees User B's conversation
```

### Why It Fails
- User data leaks between sessions
- Compliance violation (GDPR, HIPAA, etc.)
- Trust erosion (users see each other's private data)

### What To Do Instead
```javascript
// RIGHT: Tenant isolation
const getGoClawClient = (userId) => {
  // Each user gets isolated agent instance
  const channel = `user-${userId}-playground`;
  return new GoClawClient("ws://goclaw:8080", { channel });
};

app.post("/api/chat/:userId", async (req, res) => {
  const goclaw = getGoClawClient(req.params.userId);
  const result = await goclaw.send(req.body.message);
  res.json(result);
});
```

Or use **GoClaw's built-in multi-tenancy:**
```
GoClaw → PostgreSQL (tenant isolation) → agents (scoped per tenant)
```

---

## ANTI-PATTERN 10: Deploying Matrix Without Homeserver Scaling Plan

### The Mistake
```bash
# WRONG: Default Synapse (unoptimized)
docker run matrixdotorg/synapse:latest
# Out-of-the-box: 2GB RAM, single node
# 10 users works. 1000 users = OOM killed
```

### Why It Fails
- Synapse default config = local SQLite, single process
- RAM grows with state size (rooms, users, messages)
- No load balancing, no replication
- Database becomes bottleneck at scale

### What To Do Instead
```bash
# RIGHT: Scale-ready setup
# Option 1: Managed service (recommended)
# → Beeper, Matrix.org (managed), Self-hosted pros handle ops

# Option 2: Lightweight Synapse
# → PostgreSQL (not SQLite)
# → Multiple workers (sync, client, federation)
# → Redis for caching
# → Load balancer (nginx, HAProxy)

# Option 3: Alternative Homeserver
# → Conduit (Rust, 40MB RAM vs. Synapse 2GB)
# → Dendrite (Go, lighter than Synapse)
```

**Plan before deploying:**
- Matrix homeserver = production database infrastructure
- Not "just another Docker container"
- Budget 2-3 weeks for scaling setup

---

## ANTI-PATTERN 11: Not Validating Agent Cards in A2A

### The Mistake
```javascript
// WRONG: Trust agent cards blindly
const agents = await a2aClient.discoverAgents();
for (const agent of agents) {
  console.log(`Found agent: ${agent.name}`);
  // What if card is spoofed? Malicious agent in list?
}
```

### Why It Fails
- Agent Card = JSON schema of capabilities
- No built-in validation in v0.3
- Malicious agents could pretend to be legitimate ones
- Man-in-the-middle attack possible

### What To Do Instead
```javascript
// RIGHT: Validate and whitelist
const TRUSTED_AGENT_IDS = [
  "claude-team-ai",
  "copilot-team",
  // only known-good agents
];

const agents = await a2aClient.discoverAgents();
const trustedAgents = agents.filter(agent =>
  TRUSTED_AGENT_IDS.includes(agent.id)
);
// Use only trusted agents
```

Or wait for A2A v1.0 signature validation (roadmap item).

---

## ANTI-PATTERN 12: Not Rate-Limiting Agent Calls

### The Mistake
```javascript
// WRONG: No limits on tool use
app.post("/api/chat", async (req, res) => {
  const result = await generateText({
    model: "gpt-4",
    tools: mcp.tools,
    maxSteps: 1000,  // ← Unlimited steps
  });
});
```

### Why It Fails
- Agent calls tool 1000 times in a row (cost: $50+)
- API rate limits triggered
- Token spent on pointless loops
- User gets surprise bill

### What To Do Instead
```javascript
// RIGHT: Add safeguards
const result = await generateText({
  model: "gpt-4",
  tools: mcp.tools,
  maxSteps: 5,  // ← Max 5 tool calls
  maxTokens: 10000,  // ← Max 10K tokens per request
});

// Rate limit per user
const rateLimiter = new RateLimiter({
  points: 100,  // 100 requests
  duration: 60,  // per 60 seconds
});

app.post("/api/chat", async (req, res) => {
  try {
    await rateLimiter.consume(req.userId, 1);
  } catch {
    return res.status(429).json({ error: "Rate limited" });
  }
  // Proceed
});
```

---

## SUMMARY: WHAT NOT TO DO

| Anti-Pattern | Impact | Solution |
|--------------|--------|----------|
| **Hybrid stacks Day 1** | 10-14 days instead of 3 | Start with MCP only |
| **Use XMPP in 2026** | Dead protocol, no future | Use Matrix instead |
| **Agent Protocol as primary** | Unproven, incomplete | Use MCP/A2A instead |
| **MCP per request** | 50-200ms per spawn overhead | Reuse MCP connections |
| **Large messages to GoClaw** | 512KB silent drop | Chunk messages |
| **Ignore A2A latency** | 200-1500ms, not real-time | Use MCP for fast response |
| **No error handling** | Cascading failures | Add graceful degradation |
| **Expose MCP to internet** | Data breach, code theft | Hide MCP behind auth |
| **No multi-tenancy plan** | User data leaks | Isolate tenants |
| **Scale Matrix without plan** | OOM killed at 10 users | Use managed or Conduit |
| **Validate agent cards** | Spoofing, MITM attack | Whitelist trusted agents |
| **No rate limiting** | $50 bill, API throttle | Add limits + cost controls |

---

## RULES OF THUMB

1. **Start simple, scale complex** — MCP → A2A → GoClaw → Matrix
2. **One protocol per layer** — Don't mix at same level
3. **Plan infrastructure early** — Matrix/GoClaw need ops team
4. **Validate at boundaries** — Agent cards, MCP responses, user input
5. **Monitor costs** — Agent calls = API spend, rate limit proactively
6. **Test failure modes** — What happens when MCP server crashes?
7. **Never expose agent tools directly** — Always auth-gate access
8. **Measure latency early** — A2A 200ms, MCP 10ms; affects UX

---
