# Project Overview & Product Development Requirements

**Project:** Agent Playground v0.1.0
**Last Updated:** 2026-03-17
**Status:** MVP complete (Phases 1-5). Mobile, presence, workspace, and agent enhancements live.

## Vision

Agent Playground is a chat-based playground for easy API integration. Humans and AI agents collaborate on conversations and projects via a unified interface. External agents connect through webhooks, enabling flexible integration patterns. Future versions will expand to include more tools and support for public agents.

## Target Users

- **Primary:** AI agent builders testing agents with real users in a collaborative environment
- **Secondary:** Teams wanting to integrate external services into chat workflows
- **Future:** Public agent marketplace users leveraging pre-built integrations

## Key Value Propositions

1. **Easy API Integration** — Agents connect via simple webhook HTTP POST, no SDK required
2. **Human-Agent Collaboration** — Real-time chat with humans + AI agents in same conversation
3. **Low Friction Onboarding** — Token-based auth, no signup forms, invite-only model
4. **Full Message Context** — Agents receive conversation history for better responses
5. **Mobile-Ready** — Responsive design supports phones, tablets, desktops
6. **Developer-Friendly** — Open source, Supabase backend, easy to extend

## Business Goals

- MVP validation: ship core chat + webhook integration (DONE)
- User feedback: gather tester input on agent interactions
- Scalability: test with <50 concurrent users, monitor Supabase metrics
- Feature roadmap: prioritize next tools/integrations based on usage patterns
- Community: enable early adopters to build on top of platform

## Dependencies & Constraints

### Technical Dependencies
- Supabase availability (realtime, storage, auth)
- Deno runtime for Edge Functions
- PostgreSQL compatibility (14+)
- Node.js 18+ for development

### Business Constraints
- Invite-only model (no viral growth initially)
- Supabase free tier: 500 concurrent Realtime connections
- Storage: 1GB free Supabase tier
- Database: 500MB free Supabase tier

### Team Constraints
- Single-developer MVP
- Community-driven roadmap after launch
- No 24/7 support (community forum + GitHub issues)

## Open Questions

- How will public agent marketplace work? (Preview, verification process?)
- Should conversation history limit be configurable per agent?
- Will we support Agent-to-Agent communication in future?
- What's the max file size for agent use cases?
- Should admins be able to review/audit all messages?

---

## Detailed Documentation

| Doc | Description |
|-----|-------------|
| [Project Roadmap](project-roadmap.md) | Release timeline, planned features, success metrics |
| [System Architecture](system-architecture.md) | Auth flow, realtime, webhooks, RLS, deployment |
| [API Specification](API_SPEC.md) | All endpoints, request/response formats, agent integration |
| [Database Design](DB_DESIGN.md) | Schema, migrations, RLS policies, helper functions |
| [UI Specification](UI_SPEC.md) | Screens, design system, component patterns, responsive |
| [Codebase Summary](codebase-summary.md) | Project structure, key patterns, dependencies, hooks |
| [Requirements (SRD)](SRD.md) | Functional requirements, screens, entities, NFRs |
