# Code Review: chat-info-panel.tsx Lightbox & Download

**Date:** 2026-03-20
**Branch:** feat/workspace-unread-indicator
**File:** `src/components/chat/chat-info-panel.tsx`
**LOC changed:** ~60 lines added/modified

---

## Overall Assessment

Solid change. Converts image thumbnails from raw `<a>` links to an in-app lightbox, and documents from open-in-new-tab to direct download. The lightbox portal follows the existing `ImagePreview` pattern well. Several issues worth addressing, mostly around error handling and accessibility.

---

## Critical Issues

None.

---

## High Priority

### H1. `downloadFile` has no error handling

The `downloadFile` function does not catch fetch failures, CORS errors, expired Supabase signed URLs (403/404), or network errors. A failed fetch will throw an unhandled promise rejection. Since the function is called from `onClick` handlers without a surrounding try/catch, the user gets zero feedback.

**Impact:** Silent failure on expired URLs, CORS-blocked resources, or network issues. Blob URL leak if error occurs between `createObjectURL` and `revokeObjectURL`.

**Fix:**
```tsx
async function downloadFile(url: string, fileName: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Download failed: ${response.status}`);
      return;
    }
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  } catch (error) {
    console.error("Download failed:", error);
    // Optionally: toast notification for user feedback
  }
}
```

### H2. No keyboard dismiss for lightbox (Escape key)

The `ImagePreview` component also lacks this, but since this is new code and the lightbox has interactive elements (close button, download button), pressing Escape should close it. Both lightboxes share this gap.

**Fix:** Add a `useEffect` with keydown listener:
```tsx
useEffect(() => {
  if (!lightboxImage) return;
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") setLightboxImage(null);
  };
  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, [lightboxImage]);
```

---

## Medium Priority

### M1. Large file downloads can freeze the UI perception

`downloadFile` fetches the entire file into memory via `response.blob()` before triggering download. For large files (100MB+), this creates a long delay with no progress indication. The user may click multiple times thinking it didn't work, spawning concurrent downloads.

**Recommendation:** Consider adding a downloading state per document (spinner or disabled state on the button). Alternatively, for very large files, use a direct `<a download>` link instead of fetch-then-blob.

### M2. No focus trapping in lightbox

When lightbox is open, Tab key can reach elements behind the overlay. Not a breaking issue, but degrades screen reader and keyboard-only experience.

**Recommendation:** Low effort fix: add `tabIndex={-1}` and `autoFocus` to the overlay container, or use a focus-trap library if one exists in deps.

### M3. Lightbox missing `aria-label` on action buttons

Close and Download buttons have no accessible names. The close button's `<X>` icon is not announced. Download has a `title` attribute (good) but close does not.

**Fix:** Add `aria-label="Close"` to close button and `aria-label="Download"` to download button.

### M4. Concurrent download clicks not debounced

User can rapid-click the download button in the lightbox or document list, spawning multiple simultaneous fetch+download cycles for the same file.

**Recommendation:** Add a `downloading` state or disable the button during download.

---

## Low Priority

### L1. Lightbox background opacity inconsistency

`ImagePreview` uses `bg-black/50`, this new lightbox uses `bg-black/80`. Minor visual inconsistency. The darker overlay is arguably better for image viewing, but worth aligning if a consistent feel is desired.

### L2. Download button position uses fixed offset `right-16`

The download button is positioned at `right-16` (4rem) while close is at `right-4`. This works but if more action buttons are added later, the absolute positioning approach won't scale. Fine for now.

### L3. Image grid thumbnails have no loading state

Unlike `ImagePreview` which shows a pulse placeholder while loading, the grid thumbnails directly render `<img>` with no fallback. Broken/slow images show nothing or a broken icon.

---

## Edge Cases Found

1. **Expired Supabase signed URLs** - If the user opens the info panel after the URL TTL expires, thumbnails will show broken images and downloads will fail silently (ties to H1).
2. **Concurrent lightbox + archive dialog** - Both use `z-[200]` and are portaled to `document.body`. If somehow both are triggered, they layer on top of each other at the same z-index. Low probability since they're in different components, but worth noting.
3. **SSR safety** - `createPortal(... document.body)` is guarded by `lightboxImage` being truthy (state starts null), so it won't run on server. Safe.
4. **Memory: blob URL cleanup** - Current implementation revokes synchronously after `anchor.click()`. Since `click()` triggers an async browser download, the revocation timing is technically a race. In practice, browsers handle this because the download starts before the microtask, but wrapping revoke in a `setTimeout(..., 100)` is safer across all browsers.

---

## Positive Observations

- Good pattern match with existing `ImagePreview` lightbox (portal, z-index, overlay click-to-close, stopPropagation on image)
- `<a>` to `<button>` conversion is semantically correct -- these are actions, not navigations
- `text-left` added to document button to fix alignment -- good attention to detail
- `stopPropagation` correctly applied to both the image and download button in lightbox
- Clean separation: `downloadFile` as a standalone utility function

---

## Recommended Actions (Priority Order)

1. **Add try/catch and response.ok check to `downloadFile`** (H1) -- prevents silent failures and blob leaks
2. **Add Escape key handler for lightbox dismiss** (H2) -- quick win, improves UX
3. **Add `aria-label` to lightbox buttons** (M3) -- one-line fixes
4. **Consider download-in-progress state** (M1/M4) -- prevents duplicate downloads, gives user feedback
5. **Optionally** align lightbox opacity with `ImagePreview` (L1)

---

## Metrics

- Type Coverage: N/A (no new types introduced, existing types reused correctly)
- Test Coverage: N/A (no tests for this component)
- Linting Issues: Not checked (per project rules, no lint run during review)
