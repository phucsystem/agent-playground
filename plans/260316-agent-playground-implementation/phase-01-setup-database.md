# Phase 1: Setup + Database

## Context
- DB Design: `docs/DB_DESIGN.md`
- API Spec: `docs/API_SPEC.md`
- SRD: `docs/SRD.md` (E-01 through E-06)

## Overview
- **Priority:** P1
- **Status:** Pending
- **Effort:** 4h
- Initialize Next.js project, configure Supabase, deploy full database schema with RLS and functions.

## Files to Create

| File | Purpose |
|------|---------|
| `package.json` | Project deps |
| `next.config.ts` | Next.js config |
| `tailwind.config.ts` | Tailwind + design tokens |
| `tsconfig.json` | TypeScript config |
| `src/app/layout.tsx` | Root layout |
| `src/app/globals.css` | Global styles (design tokens from UI_SPEC) |
| `src/lib/supabase/client.ts` | Browser Supabase client |
| `src/lib/supabase/server.ts` | Server Supabase client (cookies) |
| `src/lib/supabase/middleware.ts` | Auth middleware |
| `src/middleware.ts` | Next.js middleware (auth guard) |
| `src/types/database.ts` | Supabase generated types |
| `supabase/migrations/001_initial_schema.sql` | Full schema migration |
| `.env.local` | Supabase URL + anon key |

## Implementation Steps

### 1. Create Next.js project
```bash
pnpm create next-app agent-playground --typescript --tailwind --eslint --app --src-dir
cd agent-playground
```

### 2. Install dependencies
```bash
pnpm add @supabase/supabase-js @supabase/ssr
pnpm add react-markdown remark-gfm rehype-highlight
pnpm add lucide-react
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button input avatar badge scroll-area separator toast dialog
```

### 3. Configure design tokens
Port all CSS variables from `prototypes/styles.css` into `src/app/globals.css`. Map to Tailwind `extend.colors` in `tailwind.config.ts`:
```typescript
// tailwind.config.ts
colors: {
  primary: {
    50: '#eff6ff', 100: '#dbeafe', /* ... */ 600: '#155dfc',
  },
  neutral: {
    50: '#f9fafb', 100: '#f4f4f5', /* ... */ 950: '#0a0a0c',
  },
  success: '#00c950',
  warning: '#f0b100',
  error: '#fb2c36',
}
```

### 4. Create Supabase project
1. Go to supabase.com → New project
2. Copy project URL + anon key → `.env.local`
3. Install Supabase CLI: `pnpm add -D supabase`
4. `npx supabase init`

### 5. Write database migration
Create `supabase/migrations/001_initial_schema.sql` with full schema from `docs/DB_DESIGN.md`:
- Custom types (conversation_type, member_role, content_type)
- All 6 tables (users, conversations, conversation_members, messages, attachments, reactions)
- All indexes
- Trigger: update_conversation_updated_at
- Enable RLS on all tables
- All RLS policies from DB_DESIGN.md
- All 3 database functions (find_or_create_dm, get_unread_counts, mark_conversation_read)
- Enable realtime on messages table
- Create storage bucket `attachments` with policies

### 6. Deploy migration
```bash
npx supabase db push
```

### 7. Generate TypeScript types
```bash
npx supabase gen types typescript --project-id $PROJECT_ID > src/types/database.ts
```

### 8. Setup Supabase clients
- `src/lib/supabase/client.ts` — browser client with `createBrowserClient()`
- `src/lib/supabase/server.ts` — server client with `createServerClient()` (cookie-based)
- `src/lib/supabase/middleware.ts` — refresh session in middleware

### 9. Create Edge Function for token auth
`supabase/functions/login-with-token/index.ts`:
1. Receive `{ token }` in body
2. Query `users` table for matching token + is_active
3. If valid: use `supabase.auth.admin.createUser()` or `signInWithPassword()` to issue JWT
4. Return JWT + user profile

### 10. Seed test data
Create `supabase/seed.sql`:
- 3 human users (admin + 2 testers) with tokens
- 2 agent users with tokens
- 1 DM conversation
- 1 group conversation with all users
- 10 sample messages

## Todo List

- [ ] Create Next.js project with TypeScript + Tailwind + App Router
- [ ] Install all dependencies (supabase, shadcn, react-markdown, lucide)
- [ ] Port design tokens to globals.css + tailwind.config.ts
- [ ] Create Supabase project + get credentials
- [ ] Write and deploy database migration (all tables, RLS, functions)
- [ ] Generate TypeScript types from schema
- [ ] Setup Supabase client/server helpers
- [ ] Create login-with-token Edge Function
- [ ] Create seed data
- [ ] Verify: `npx supabase db push` succeeds, seed runs, types generated

## Success Criteria

- `pnpm dev` runs Next.js on localhost:3000
- Supabase dashboard shows all 6 tables with correct schemas
- RLS policies active on all tables
- Edge Function `/login-with-token` returns JWT for valid token
- Generated types match DB schema
- Seed data visible in Supabase dashboard

## Risks

| Risk | Mitigation |
|------|------------|
| Supabase Edge Function cold start | Accept for MVP. <50 users won't trigger often. |
| RLS policy errors | Test each policy manually in Supabase SQL editor before proceeding. |
