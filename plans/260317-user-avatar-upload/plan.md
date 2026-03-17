---
status: completed
date: 2026-03-17
slug: user-avatar-upload
---

# Plan: User Avatar Upload

## Summary
Allow users to upload custom avatar images via profile click in sidebar. Coexists with DiceBear generation. Uses Supabase Storage public bucket + client-side crop/resize via `react-easy-crop`.

## Brainstorm Reference
- `plans/reports/brainstorm-260317-user-avatar-upload.md`

## Phases

| # | Phase | Status | Priority | Effort |
|---|-------|--------|----------|--------|
| 1 | Storage & Migration | completed | high | small |
| 2 | Avatar Upload Hook | completed | high | medium |
| 3 | Profile Avatar Dialog UI | completed | high | medium |
| 4 | Integration & Polish | completed | medium | small |

## Dependencies
- Phase 2 depends on Phase 1 (bucket must exist)
- Phase 3 depends on Phase 2 (hook must exist)
- Phase 4 depends on Phase 3 (dialog must exist)

## Key Decisions
- Public `avatars` bucket (no signed URLs needed)
- `react-easy-crop` for circle crop
- Output: 256x256 WebP, overwrite per user (`{userId}.webp`)
- Cache-busting via `?t={timestamp}` query param
- User clicks sidebar avatar → dialog opens
- DiceBear styles coexist as "Generate" tab
