---
PR: #6142 (TS-3384: insight update of book-for-guest)
Date: 2026-03-18
Reviewer: code-reviewer
---

# Code Review: PR #6142 — TS-3384 book-for-guest insight update

## Scope
- Files: insurance-addon-base.vue, user-search-multiselect.vue, insights/travel/filters.vue, frequent-traveller.vue, recent-bookings.vue
- Focus: UI/UX correctness, tab system, guest badge, insurance guest handling, insights components

## Overall Assessment

Solid feature direction. The tab system is well-structured and the guest badge pattern is consistent. Key risks: inconsistent guest-identity signals (`isGuest` flag vs `referenceType`), count display mismatch (loaded vs total), and hardcoded design tokens.

---

## Critical Issues

### 1. Inconsistent guest-identity signal (Cross-cutting)
**Impact: Data integrity / silent bugs**

`user-search-multiselect` tags guests via `isGuest: true` (set manually in `fetchGuests`). The insights components (`frequent-traveller.vue`, `recent-bookings.vue`) check `referenceType === 'UserGuest'`. Insurance checks `traveller.isGuest`.

Risk: `isGuest` is a client-injected flag — it only exists if the object came through `fetchGuests`. If a guest appears via another code path (e.g., pre-selected, loaded from booking state), `isGuest` will be `undefined`/falsy, silently falling through to `isTravellerEligibleForInsurance()`. A guest could then be offered insurance they are not eligible for.

**Fix:** Standardize on `referenceType === 'UserGuest'` as the canonical check everywhere, including the insurance component. If the insurance component receives travellers from a booking (not the multiselect), those travellers will have `referenceType` set by the API, making it reliable.

```diff
- <div v-if="traveller.isGuest" class="flex items-center">
+ <div v-if="traveller.referenceType === 'UserGuest'" class="flex items-center">
```

Extract to a shared util or computed prop rather than repeating the string literal (see Medium #7).

---

## High Priority

### 2. Guest count reflects loaded items, not API total
**Impact: UX confusion**

`guestCount` returns `this.guests.length` (max 150 per request). If there are 200 guests, the tab label shows "(150)", not "(200)". Employee tab has the same issue via `this.users.length`. Users will see counts that don't match actual totals.

**Fix:** Capture and expose the API total from `getGuests` response alongside the loaded array. Update the count computed to use `this.guestTotal ?? this.guests.length` as a fallback. Same pattern should apply to employee count.

### 3. Selection state not preserved across tab switches
**Impact: UX regression**

`filteredUsers` swaps the entire list when the tab changes. `selectedItems` / `selectedUsersList` hold references that persist, but the checkbox binding in the template (not shown in diff, inferred from context) likely uses `filteredUsers` to render — so a guest selected on the Guest tab becomes invisible when switching to Employee tab, giving no visual confirmation of the cross-tab selection.

**Fix:** Either:
- Render a combined "selected" summary section above the list (recommended), or
- Ensure selectedItems always shows selections from both tabs regardless of active tab, with badge indicators in the selection chips.

### 4. `debounceSearch` fires two network calls per keystroke
**Impact: Performance / API load**

```js
debounceSearch: debounce(function () {
  this.userSize = 150
  this.searchUsers(this.name)
  if (this.showTabs) { this.searchGuests(this.name) }
}, 300),
```

Both `searchUsers` and `searchGuests` run inside one debounce callback — this is correct for debouncing. However, both are fired unconditionally when tabs are shown, even if the user is on the Employee tab. Consider skipping the inactive-tab search to reduce API pressure, or at minimum ensure the loading states are independent so one slow response does not block the other.

---

## Medium Priority

### 5. `searchGuests` is a redundant wrapper
**Q2 addressed**

`searchGuests(text)` calls `fetchGuests(text)` directly with no additional logic. This is dead abstraction. Either inline `fetchGuests` at the call site or rename it `searchGuests` and remove the wrapper.

```diff
- async searchGuests(text) { await this.fetchGuests(text) },
```
Just call `this.fetchGuests(text)` directly in `debounceSearch`.

### 6. Hardcoded design tokens in styles
**Q5 addressed**

The following values are hardcoded and likely deviate from project design tokens:
- `#2EA2F8` (primary blue — should be a CSS variable or Stylus variable)
- `#354052` (text dark — likely `$color-text-primary` or similar)
- `#666` (muted text)
- `#f0f0f0`, `#e0e0e0` (neutral borders/backgrounds)

If the project uses a Stylus variable system or CSS custom properties (check `assets/styles/variables.styl` or equivalent), replace all instances. Hardcoded values will break theme consistency and are invisible to future design token updates.

### 7. `referenceType === 'UserGuest'` string literal duplicated across 3 files
**Q8 addressed**

Appears in: `frequent-traveller.vue`, `recent-bookings.vue`, and (should be) `insurance-addon-base.vue`. This magic string should be centralized:

```js
// utils/traveller.js
export const isGuestTraveller = (traveller) => traveller?.referenceType === 'UserGuest'
```

Or as a mixin/composable computed. Prevents typo bugs and makes future referenceType changes a one-line fix.

### 8. `text--nowrap` CSS class looks like a typo
**Q8 addressed**

```html
<span class="text-neutral-primary-on-white text--nowrap w-fit">
```

`text--nowrap` (double dash) is not a standard Tailwind utility. The correct class is `whitespace-nowrap`. This will silently have no effect — text will wrap unexpectedly on narrow screens. Verify against the project's utility class catalog.

`text-neutral-primary-on-white` — non-standard Tailwind. Confirm this is a project-defined custom utility class. If not, it will also silently fail.

---

## Low Priority

### 9. Index `i` as `v-for` key
**Q6 addressed**

```diff
- <div v-for="(traveller, i) in item.travellers" :key="i">
```

Two issues:
- `i` is a single-character variable name, violating the no-single-char rule per dev rules. Should be `index` or `travellerIndex`.
- Using index as key is an anti-pattern when the list can reorder or change — prefer `traveller.id` or a stable unique field if available.

```diff
+ <div v-for="(traveller, travellerIndex) in item.travellers" :key="traveller.id ?? travellerIndex" class="flex items-center gap-2">
```

### 10. Commented-out email span removed without trace
**Low signal**

```diff
- <!-- <span class="email">{{ usr.email }}</span> -->
+  <span v-if="usr.isGuest" class="guest-badge">...</span>
```

The email span was already commented out; replacing it with the guest badge is fine. Just confirm the email display was intentionally dropped and not needed for the guest row (guests may have different identifier display requirements).

### 11. `mounted()` guest fetch skips loading state
**Minor UX**

`fetchGuests()` is called in `mounted()` but there is no loading skeleton or spinner shown in the Guest tab before data arrives. `searchingGuest` state exists but the template diff does not show it being used for a loading indicator. Add a minimal loading state to the Guest tab button or list area.

---

## Positive Observations

- `@click.stop` on tab buttons correctly prevents dropdown close — good defensive event handling.
- `reset()` restoring `activeTab = 'employee'` is the right UX behavior on clear.
- `v-else-if` chain in insurance component is a clean fix over the previous flat `v-if` — logic is now correctly mutually exclusive.
- `GuestBadge` component reuse across insights files is the right approach; keeps badge styling centralized.
- Debounce at 300ms on search is appropriate.

---

## Summary of Actions (Prioritized)

1. **Critical** — Replace `traveller.isGuest` with `traveller.referenceType === 'UserGuest'` in insurance component for consistency and correctness.
2. **High** — Fix guest/employee counts to reflect API totals, not loaded array lengths.
3. **High** — Add cross-tab selection visibility (selected chips or summary row).
4. **Medium** — Remove `searchGuests` wrapper; call `fetchGuests` directly.
5. **Medium** — Replace all hardcoded color values with design token variables.
6. **Medium** — Centralize `referenceType === 'UserGuest'` into a shared utility.
7. **Medium** — Fix `text--nowrap` typo to `whitespace-nowrap`.
8. **Low** — Rename `i` to `travellerIndex`; prefer stable key over index.
9. **Low** — Add loading indicator for Guest tab initial fetch.

---

## Unresolved Questions

- Does `getGuests` API return a `total` field alongside `guests` array? If not, backend change needed for accurate count display.
- Is `text-neutral-primary-on-white` a project-defined custom Tailwind class or a typo?
- Was the email span removal intentional? Does the guest row need an alternate identifier (email, guest ID)?
- Does `userTypes` prop have validation (`validator` function) to prevent invalid values being passed?
