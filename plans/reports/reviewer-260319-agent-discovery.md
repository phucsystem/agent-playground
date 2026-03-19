# Code Review: Agent Discovery Feature

**Date:** 2026-03-19
**Branch:** `feat/agent-discovery`
**Reviewer:** code-reviewer

---

## Scope

- **New files (11):** migration, types, 2 hooks, 6 components, 1 page
- **Modified files (6):** database types, agent configs hook, sidebar, admin page, chat input, conversation page
- **Estimated LOC:** ~650 new, ~120 modified
- **Focus:** security, TypeScript, React patterns, performance, edge cases

## Overall Assessment

Well-structured feature with clean component decomposition, proper TypeScript typing, and good UX patterns (skeleton loading, empty states, debounced hover cards). However, there is one **critical** RLS issue that will break the feature for non-admin users, plus several medium-priority items.

---

## Critical Issues

### 1. RLS blocks non-admin users from `agent_configs` (SHOWSTOPPER)

**File:** `supabase/migrations/023_agent_metadata.sql`, `src/hooks/use-agent-catalog.ts`

The `agent_configs` table has admin-only SELECT RLS (from `007_agent_webhooks.sql`):
```sql
CREATE POLICY "agent_configs_select" ON agent_configs
  FOR SELECT USING (is_admin());
```

`useAgentCatalog` queries `agent_configs` directly from the browser client (line 34-37). Non-admin users will get zero results -- the entire discovery page is empty for regular users.

**Fix:** Either:
- (A) Add a new RLS policy allowing all authenticated users to SELECT the non-sensitive columns, or
- (B) Create a `SECURITY DEFINER` RPC function (like `get_agent_catalog`) that returns only safe fields (excluding `webhook_url`, `webhook_secret`), and call that from the hook instead.

Option B is safer -- it ensures `webhook_url` and `webhook_secret` are never exposed to non-admin users.

### 2. `get_agent_stats` RPC: `SECURITY DEFINER` without auth check

**File:** `supabase/migrations/023_agent_metadata.sql` (line 18-35)

The function is `SECURITY DEFINER` (runs as owner, bypassing RLS) but performs no `auth.uid()` check. Any unauthenticated request with valid agent UUIDs can query delivery stats.

**Fix:** Add guard at top:
```sql
IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Not authenticated';
END IF;
```
Note: need to change from `LANGUAGE sql` to `LANGUAGE plpgsql` for this.

---

## High Priority

### 3. `useAgentStats` query key instability creates unnecessary refetches

**File:** `src/hooks/use-agent-stats.ts` (line 36)

`queryKey: ["agent-stats", sortedIds.join(",")]` -- every time the `allAgents` array reference changes (even with same agents), `agentUserIds` is recomputed, `sortedIds` changes reference, `.join(",")` produces same string but the array itself is new. However the join produces a stable string, so this is actually fine for React Query. The real issue is that `sortedIds` is recalculated on every render since `agentIds` is a new array each time. The `sort()` + `join()` mitigates this for the query key, but the `queryFn` closure captures a new `sortedIds` array reference each render.

**Impact:** Minor -- React Query uses key equality, and the string join stabilizes it. But worth wrapping `agentUserIds` in `useMemo` (already done in `page.tsx` line 29-31, which is correct).

### 4. `initialPrompt` effect missing `adjustHeight` dependency

**File:** `src/components/chat/chat-input.tsx` (line 203-211)

```tsx
useEffect(() => {
  if (initialPrompt && !content) {
    setContent(initialPrompt);
    // ...
    adjustHeight();
  }
}, [initialPrompt]); // missing: content, adjustHeight
```

React will warn about missing deps. More importantly, `adjustHeight` is a `useCallback` with no deps so it's stable, but `content` changing could cause stale closure issues. Since the intent is "run once when initialPrompt arrives", consider a ref-based guard instead:

```tsx
const initialPromptAppliedRef = useRef(false);
useEffect(() => {
  if (initialPrompt && !initialPromptAppliedRef.current) {
    initialPromptAppliedRef.current = true;
    setContent(initialPrompt);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      adjustHeight();
    });
  }
}, [initialPrompt, adjustHeight]);
```

### 5. `AgentHoverCard` tooltip has `pointer-events-none` but also `onMouseEnter`/`onMouseLeave`

**File:** `src/components/agents/agent-hover-card.tsx` (line 60-62)

The tooltip `div` has `pointer-events-none` class, but also has `onMouseEnter={show}` and `onMouseLeave={hide}` handlers. The handlers will never fire because pointer events are disabled. This means mousing from the trigger into the tooltip will trigger `hide` from the container's `onMouseLeave`, causing the tooltip to flicker/close prematurely.

**Fix:** Remove `pointer-events-none` from the tooltip div so the enter/leave handlers work as intended, allowing smooth hover transitions between trigger and tooltip.

---

## Medium Priority

### 6. Markdown description in `AgentDetailSheet` renders user-supplied HTML via `MarkdownContent`

**File:** `src/components/agents/agent-detail-sheet.tsx` (line 89)

`MarkdownContent` uses `react-markdown` with `rehype-highlight`. By default `react-markdown` strips raw HTML, but `rehype-highlight` processes code blocks. The description field is admin-supplied (through the agent create/edit forms). Since only admins can set descriptions (via admin panel), and the `agent_configs` table is admin-only for writes, the XSS risk is low (admin-to-user). However, if the RLS is relaxed per fix #1, ensure the description still cannot contain arbitrary HTML.

**Impact:** Low-medium. No `rehype-raw` plugin is used, so raw HTML is stripped. Current setup is safe.

### 7. No input validation on tags count or description length in the catalog query

**File:** `src/hooks/use-agent-catalog.ts`

Plan specifies `tags: max 10` and `description: max 1000 chars`, but these constraints are only enforced at the UI level (`maxLength={1000}` on textarea, no tag count check). The database has no CHECK constraint. Admin users could bypass UI and insert excessive data via Supabase client.

**Fix:** Add CHECK constraints in migration:
```sql
ADD CONSTRAINT chk_tags_count CHECK (array_length(tags, 1) IS NULL OR array_length(tags, 1) <= 10),
ADD CONSTRAINT chk_description_length CHECK (length(description) <= 1000),
ADD CONSTRAINT chk_sample_prompts_count CHECK (array_length(sample_prompts, 1) IS NULL OR array_length(sample_prompts, 1) <= 5)
```

### 8. `is_featured` in admin create form uses `|| undefined` instead of checking explicitly

**File:** `src/app/admin/page.tsx` (line 324)

```tsx
is_featured: agentIsFeatured || undefined,
```

When `agentIsFeatured` is `false`, this evaluates to `undefined`, so the field is omitted from the insert. Since the DB default is `false`, this works correctly but is semantically misleading. If someone later changes the DB default, this breaks.

**Fix:** `is_featured: agentIsFeatured` (always include the value).

### 9. `filterCatalog` runs on every render, not memoized

**File:** `src/hooks/use-agent-catalog.ts` (line 99-100)

```tsx
const filtered = query.data ? filterCatalog(query.data, filters) : [];
const featured = query.data?.filter((entry) => entry.is_featured) ?? [];
```

These run on every render of any component consuming this hook. For small agent counts (<100), this is fine. For larger catalogs, wrap in `useMemo` keyed on `[query.data, filters.category, filters.search]`.

### 10. `CATEGORIES` exported from `category-filter-bar.tsx` is a mutable array of React elements

**File:** `src/components/agents/category-filter-bar.tsx` (line 16, 64)

`CATEGORIES` is a module-level mutable array containing JSX icon elements. It's imported by `agent-card.tsx`, `agent-detail-sheet.tsx`, and `agent-hover-card.tsx`. While it works, a shared constant with JSX nodes is somewhat unusual.

**Suggestion:** Extract to a dedicated `agent-categories.ts` constants file, or use `as const` and lazy-render icons.

---

## Low Priority

### 11. `AgentDetailSheet` overlay doesn't trap focus or handle Escape key

The sheet uses a backdrop div for closing but has no keyboard trap or Escape handler. For accessibility (a11y), add `onKeyDown` handler for Escape on the sheet container, and consider focus trapping.

### 12. Search input in agents page has no debounce

**File:** `src/app/chat/agents/page.tsx` (line 62)

`setSearchQuery` fires on every keystroke. Since filtering is client-side (no API call), the perf impact is minimal. But for UX polish, consider debouncing by 200ms if the list grows.

### 13. `promptParam` URL cleanup could race with component unmount

**File:** `src/app/chat/[conversationId]/page.tsx` (line 32-36)

The `useEffect` calls `routerNav.replace()` to strip `?prompt=`. If the user navigates away immediately, the replace might race. Unlikely to cause issues but worth noting.

---

## Positive Observations

1. **Clean separation of concerns** -- types, hooks, and components are well-organized into distinct files
2. **Proper TypeScript** -- no `any`, good use of discriminated types, proper null handling
3. **Good React Query usage** -- stable keys, appropriate `staleTime`, proper `enabled` guards
4. **Composite index** on `webhook_delivery_logs` is correctly designed for the stats query
5. **Partial index** for `is_featured` is a nice optimization for a sparse flag
6. **Skeleton loading** and meaningful empty states enhance UX
7. **Mobile responsive** -- hamburger menu, responsive grid (`grid-cols-1 sm:2 lg:3`)
8. **Feature flag approach** via `is_featured` boolean keeps it simple (YAGNI)

---

## Recommended Actions

| Priority | Action | Effort |
|----------|--------|--------|
| **CRITICAL** | Fix RLS: create `SECURITY DEFINER` RPC for catalog or add read policy | 1h |
| **CRITICAL** | Add auth check to `get_agent_stats` RPC | 15m |
| **HIGH** | Fix `pointer-events-none` on hover card tooltip | 5m |
| **HIGH** | Fix `initialPrompt` useEffect deps / use ref guard | 10m |
| **MEDIUM** | Add DB CHECK constraints for tags/description/prompts limits | 15m |
| **MEDIUM** | Fix `is_featured: agentIsFeatured || undefined` to just `agentIsFeatured` | 2m |
| **LOW** | Add Escape key handler to AgentDetailSheet | 10m |
| **LOW** | Debounce search input | 10m |

---

## Unresolved Questions

1. Should non-admin users be able to see `webhook_url` and `health_check_url` on agent profiles? Currently these fields are fetched but not displayed in the catalog UI. The RPC approach (fix #1) should exclude them.
2. Should `category` be enforced as an enum at the DB level (CHECK constraint against known values) or remain a free-text field?
3. The `agent_id` in `get_agent_stats` maps to `wdl.agent_id` -- is this the `agent_configs.id` or the `user_id`? The hook passes `user_id` values but the stats function filters on `wdl.agent_id`. Verify these are the same column reference.
