# Research Report: GoClaw Agent Integration

**Date:** 2026-03-20
**Sources:** 5 (docs.goclaw.sh, GitHub README, WebSearch results)

---

## Executive Summary

GoClaw is a production-grade multi-agent AI gateway — single Go binary (~25MB), <1s startup, 20+ LLM providers, 7 messaging channels. It's a Go port of OpenClaw with enhanced security, multi-tenant PostgreSQL, and production observability.

For Agent Playground integration, the **best approach is the OpenAI-compatible REST API** (`POST /v1/chat/completions`) — zero SDK needed, works with existing webhook architecture. Secondary option: WebSocket RPC for real-time streaming. MCP integration provides a third pathway for tool-based agent communication.

---

## Key Findings

### 1. GoClaw Architecture

**Core Loop:** Think → Act → Observe (max 20 iterations per turn, configurable)

**Agent Types:**
- **Open Agents** — per-user customizable context files (SOUL, IDENTITY, AGENTS, TOOLS, USER, BOOTSTRAP, MEMORY)
- **Predefined Agents** — fixed shared personality, 4 read-only context files, 3 per-user files

**Orchestration Patterns:**
1. **Sync Delegation** — Agent A calls Agent B, waits for result
2. **Async Delegation** — Agent A spawns Agent B, continues immediately
3. **Teams** — shared task board with dependency tracking
4. **Handoff** — transfer control entirely to another agent

**Concurrency Lanes:**

| Lane | Limit | Purpose |
|------|:-----:|---------|
| main | 30 | Channel messages, WebSocket |
| subagent | 50 | Spawned subagent tasks |
| delegate | 100 | Agent-to-agent delegation |
| cron | 30 | Scheduled jobs |

### 2. Integration Options (Ranked)

#### Option A: REST API (Recommended)

OpenAI-compatible chat completions endpoint — simplest integration path.

```bash
POST /v1/chat/completions
Authorization: Bearer YOUR_GATEWAY_TOKEN
X-GoClaw-User-Id: user-123
Content-Type: application/json

{
  "model": "goclaw:your-agent-key",
  "messages": [{"role": "user", "content": "Hello!"}]
}
```

**Pros:** Drop-in replacement for any OpenAI-compatible client. Agent Playground already has webhook infrastructure for agent responses. Minimal code changes.

**Cons:** No streaming. One request = one response cycle.

#### Option B: WebSocket RPC

64+ methods. Real-time streaming. Full agent lifecycle control.

```json
// Auth
{"type": "req", "id": "1", "method": "connect", "params": {"token": "TOKEN", "user_id": "system"}}

// Send message
{"type": "req", "id": "2", "method": "chat.send", "params": {"agentId": "agent-key", "message": "Hello!"}}

// Stream response
{"type": "req", "id": "3", "method": "chat.stream", "params": {"agentId": "agent-key", "message": "Hello!"}}
```

**Available Methods:** agent.list, agent.create, agent.update, agent.delete, session.list, session.history, session.clear, memory.search, trace.list, event.stream, provider.list, provider.add + many more.

**Pros:** Real-time streaming, full agent management, session control. Best UX for chat interface.

**Cons:** More complex implementation. Need WebSocket client in Next.js API routes.

#### Option C: MCP Integration

GoClaw can connect to MCP servers (stdio, SSE, streamable-HTTP). Also has its own MCP server (66 tools).

```jsonc
"tools": {
  "mcp_servers": {
    "filesystem": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"],
      "enabled": true,
      "tool_prefix": "fs_",
      "timeout_sec": 60
    },
    "remote-api": {
      "transport": "streamable-http",
      "url": "https://api.example.com/mcp",
      "headers": {"Authorization": "env:MCP_API_KEY"},
      "enabled": true
    }
  }
}
```

**Pros:** Extensible tool ecosystem. Can expose Agent Playground's Supabase data as MCP resources.

**Cons:** Overkill for basic agent chat integration. Better suited for extending GoClaw's tool capabilities.

### 3. Channel Integration (Alternative Approach)

Instead of API integration, GoClaw can directly connect to messaging channels:
- **Telegram, Discord, Slack, WhatsApp, Zalo, Feishu/Lark** — built-in channel adapters
- **WebSocket** — custom client integration

Each channel supports: streaming, reactions, media, voice (STT), per-group agent routing, access policies (pairing/allowlist/open/disabled).

### 4. Deployment

```bash
# Local
git clone https://github.com/nextlevelbuilder/goclaw.git && cd goclaw
make build
./goclaw onboard    # Interactive setup wizard
source .env.local && ./goclaw

# Docker
chmod +x prepare-env.sh && ./prepare-env.sh
docker compose -f docker-compose.yml -f docker-compose.postgres.yml \
  -f docker-compose.selfservice.yml up -d
```

**Required env vars:**
```bash
GOCLAW_GATEWAY_TOKEN=<bearer-token>
GOCLAW_ENCRYPTION_KEY=<aes-256-key>
GOCLAW_POSTGRES_DSN=postgresql://user:pass@localhost/goclaw
GOCLAW_ANTHROPIC_API_KEY=<key>   # + any other provider keys
```

**Default port:** 18790

### 5. Agent Configuration

```jsonc
{
  "agents": {
    "defaults": {
      "provider": "anthropic",
      "model": "anthropic/claude-sonnet-4-5-20250929",
      "max_tokens": 8192,
      "temperature": 0.7,
      "max_tool_iterations": 20
    },
    "list": {
      "playground-assistant": {
        "displayName": "Playground Assistant",
        "model": "anthropic/claude-opus-4-6",
        "temperature": 0.3,
        "tools": {"profile": "coding"},
        "identity": {"name": "Assistant", "emoji": "🤖"}
      },
      "code-reviewer": {
        "displayName": "Code Reviewer",
        "model": "anthropic/claude-sonnet-4-5-20250929",
        "tools": {"profile": "coding", "deny": ["exec"]},
        "identity": {"name": "Reviewer"}
      }
    }
  }
}
```

### 6. Security Features

- **Shell Deny Groups** — 15 default categories (destructive_ops, data_exfil, reverse_shell, code_injection, etc.)
- **Exec Approval** — deny / allowlist / full modes with ask: off / on-miss / always
- **Rate Limiting** — per-user, per-provider, per-channel quotas
- **Injection Detection** — SQL/prompt injection detection with configurable action (log/warn/block)
- **SSRF Protection** — built-in
- **AES-256-GCM** encryption for stored API keys

---

## Recommended Integration Architecture

```mermaid
graph TB
    subgraph "Agent Playground (Next.js)"
        UI[Chat UI]
        API[API Routes]
        WH[Webhook Handler]
        SB[(Supabase)]
    end

    subgraph "GoClaw Gateway"
        GW[REST API :18790]
        WS[WebSocket RPC]
        A1[Agent: Assistant]
        A2[Agent: Code Reviewer]
        A3[Agent: Researcher]
        TB[Team Task Board]
    end

    UI --> API
    API -->|POST /v1/chat/completions| GW
    API -->|WebSocket| WS
    GW --> A1 & A2 & A3
    A1 -->|delegation| A2
    A2 -->|team_message| TB
    WH -->|webhook callback| SB
```

### Implementation Steps

**Phase 1 — REST API Integration (Simplest)**
1. Deploy GoClaw locally or via Docker
2. Configure agents in `config.json`
3. Create Next.js API route: `POST /api/goclaw/chat`
4. Route calls to `http://localhost:18790/v1/chat/completions`
5. Map GoClaw responses to existing message schema in Supabase

**Phase 2 — WebSocket Streaming**
1. Add WebSocket client in Next.js API route
2. Use `chat.stream` for real-time token streaming
3. Pipe streamed tokens to client via Server-Sent Events or existing Supabase Realtime

**Phase 3 — Multi-Agent Teams**
1. Configure agent delegation links in GoClaw config
2. Create team with shared task board
3. Map team events to Agent Playground conversation threads

### Code Example: Next.js API Route

```typescript
// src/app/api/goclaw/chat/route.ts
import { NextRequest, NextResponse } from "next/server";

const GOCLAW_URL = process.env.GOCLAW_URL || "http://localhost:18790";
const GOCLAW_TOKEN = process.env.GOCLAW_GATEWAY_TOKEN;

export async function POST(request: NextRequest) {
  const { agentKey, message, userId } = await request.json();

  const response = await fetch(`${GOCLAW_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GOCLAW_TOKEN}`,
      "X-GoClaw-User-Id": userId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: `goclaw:${agentKey}`,
      messages: [{ role: "user", content: message }],
    }),
  });

  const data = await response.json();
  return NextResponse.json(data);
}
```

---

## Comparative Analysis

| Feature | Current (Direct API) | GoClaw Gateway |
|---------|---------------------|----------------|
| Agent count | Manual per-provider | Unlimited, hot-reload |
| Multi-agent collab | None | Delegation + Teams |
| Tool execution | None | 33+ built-in + MCP |
| Memory/context | Per-session only | Persistent + semantic search |
| Security | Basic | 5-tier + injection detection |
| Observability | Logs only | OpenTelemetry + traces |
| Channel support | Web only | Web + 7 messaging channels |
| Deployment | N/A | Single binary or Docker |

---

## Common Pitfalls

1. **Agent key vs Agent ID** — REST API uses `agent_key` (display name), WebSocket uses agent UUID. Don't mix them.
2. **Context window overflow** — GoClaw auto-compacts but set `compaction` and `context_pruning` config early.
3. **Tool iteration limits** — Default 20 iterations. Increase for complex multi-step tasks.
4. **Hot reload scope** — Config changes auto-reload except `gateway.host` and `gateway.port` (require restart).
5. **Subagent depth** — Default `maxSpawnDepth: 1`. Increase carefully to avoid runaway chains.

---

## Resources & References

### Official Documentation
- [GoClaw Docs](https://docs.goclaw.sh/) — Full documentation
- [GoClaw Full Docs (llms.txt)](https://docs.goclaw.sh/llms-full.txt) — Complete reference in plaintext

### GitHub
- [nextlevelbuilder/goclaw](https://github.com/nextlevelbuilder/goclaw) — Source code + README
- [GoClaw MCP Server](https://www.pulsemcp.com/servers/nextlevelbuilder-goclaw) — 66 tools for managing GoClaw

### Related
- [Claude CLI as LLM Provider PR](https://github.com/nextlevelbuilder/goclaw/pull/61) — Claude Code integration via MCP bridge

---

## Unresolved Questions

1. **Webhook callbacks** — Does GoClaw support webhook callbacks for async delegation results? (Not found in docs — may need WebSocket event.stream instead)
2. **Supabase as MCP resource** — Can we expose Supabase tables as MCP resources for GoClaw agents to query directly?
3. **Session mapping** — How to map GoClaw sessions to Agent Playground conversation IDs? May need custom middleware.
4. **Cost tracking** — GoClaw has usage metrics per trace. How to surface these in Agent Playground's admin panel?
