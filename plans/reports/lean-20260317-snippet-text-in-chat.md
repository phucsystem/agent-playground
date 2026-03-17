# Lean Feature Analysis: Send Long Snippet Text in Chat

## Current State

Snippet infrastructure **partially exists** but is incomplete:

| Component | Status | File |
|-----------|--------|------|
| `SnippetModal` | ✅ Working | `src/components/chat/snippet-modal.tsx` |
| `SnippetCard` | ❌ Exists but **never imported/rendered** | `src/components/chat/snippet-card.tsx` |
| `chat-input.tsx` | ✅ Sends snippet with metadata (`is_snippet`, `snippet_title`, `line_count`) | `src/components/chat/chat-input.tsx` |
| `message-item.tsx` | ❌ No snippet detection — renders as plain text/markdown | `src/components/chat/message-item.tsx` |
| `message-list.tsx` | ⚠️ Has height estimate for snippets (`is_snippet → 200px`) | `src/components/chat/message-list.tsx` |

**Current behavior:** User clicks FileCode icon → SnippetModal opens → enters title + content → sends as `content_type: "text"` with metadata `{ is_snippet: true, snippet_title, line_count }` → **but message renders as plain markdown text**, not as a distinct snippet card.

## Problem/Opportunity

1. **Broken rendering pipeline** — `SnippetCard` component exists with expand/collapse + copy + line count, but `MessageContent` in `message-item.tsx` never checks `is_snippet` metadata to render it
2. **Long text floods chat** — Without the card, long snippets (100+ lines) dominate the conversation thread with no collapse
3. **No visual distinction** — Snippets look identical to regular messages, defeating the purpose of the feature

## Proposed Changes

| # | Change | User Value | Effort | Priority |
|---|--------|------------|--------|----------|
| 1 | Wire `SnippetCard` into `MessageContent` (check `meta?.is_snippet` before default case) | Snippets render as collapsible cards with title, copy, line count | S | P1 |
| 2 | Auto-detect long paste in chat input (>10 lines or >500 chars) → prompt snippet modal | Users don't need to manually click FileCode button for large pastes | S | P2 |
| 3 | Snippet syntax highlighting (detect language from title extension or content) | Better readability for code snippets | M | P3 |

## Impact Analysis

- **Affected screens:** S-03 (DM Chat), S-04 (Group Chat)
- **Affected components:**
  - `message-item.tsx` — add `is_snippet` check in `MessageContent` switch
  - `snippet-card.tsx` — already complete, just needs import
  - `chat-input.tsx` — optional auto-detect for P2
- **Affected entities:** None (metadata schema already supports snippets)
- **Database changes:** None

## Assumptions

1. `SnippetCard` component was intentionally designed but connection was missed during integration — Validate by: checking git history
2. Users primarily paste code/logs/configs as long text — Validate by: observing usage patterns

## Recommendation

**P1 is a quick win** — the card already exists, just needs wiring. This is essentially a bug fix (broken feature integration), not new feature work. Estimate: ~15 min.

P2 (auto-detect) improves UX significantly — users won't need to know about the snippet button. Detect on paste event: if pasted text exceeds threshold, auto-open snippet modal with content pre-filled.

P3 (syntax highlighting) is nice-to-have, `rehype-highlight` is already in the project for markdown code blocks.

## Next Step

→ Run `/plan` to implement P1 (wire SnippetCard) + optionally P2 (auto-detect long paste)
