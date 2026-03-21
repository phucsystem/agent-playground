# Phase 4: Health Check + Environment Config

## Context
- [Health check route](../../src/app/api/agents/health/route.ts) — existing health check logic
- [.env.example](../../.env.example) — current env vars

## Overview
- **Priority:** P3
- **Status:** complete
- **Effort:** 30m

## Requirements
- Document how to configure GoClaw agent's health_check_url
- Update .env.example with GoClaw vars
- Update system-architecture.md with GoClaw bridge diagram
- Provide setup instructions

## Implementation Steps

### 1. Environment Variables

Already handled in Phase 2 (.env.example update). Verify:
```env
# GoClaw integration (for AI agent bridge)
GOCLAW_URL=https://your-goclaw-server.com
GOCLAW_GATEWAY_TOKEN=your-gateway-token
```

### 2. Health Check Configuration

GoClaw exposes `/health` endpoint. When creating a GoClaw-backed agent:
- Set `health_check_url` to `{GOCLAW_URL}/health`
- Existing health check route (`/api/agents/health`) already handles this

No code changes needed — just documentation.

### 3. Update system-architecture.md

Add GoClaw integration section to existing architecture doc:
- Bridge flow diagram
- Env var requirements
- Agent config setup instructions

### 4. Setup Guide

Document in a comment block or docs section:

1. Deploy GoClaw server (or use existing)
2. Set `GOCLAW_URL` and `GOCLAW_GATEWAY_TOKEN` in `.env`
3. Create agent in Admin panel
4. Set webhook URL to: `https://<your-app-domain>/api/goclaw/bridge`
5. Set webhook secret (bridge validates this)
6. Set health check URL to: `https://<goclaw-server>/health`
7. Set GoClaw Agent Key to match agent key in GoClaw config
8. Send a message to test

## Todo
- [x] Verify .env.example updated (Phase 2)
- [x] Add GoClaw bridge section to system-architecture.md
- [x] Document setup steps in architecture doc

## Success Criteria
- .env.example has GoClaw vars
- system-architecture.md documents the bridge flow
- Setup steps are clear and complete
- Health check works for GoClaw agents via existing infrastructure

## Risk Assessment
- GoClaw `/health` endpoint may not exist on older versions — document minimum version
