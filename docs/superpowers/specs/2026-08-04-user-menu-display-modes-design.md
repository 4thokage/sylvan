# Design: Custom User Menu + Display Modes + Visual Spoiler Fix

Date: 2026-08-04
Status: Approved (design review)

## Overview

Three related UI improvements:

1. **Custom user dropdown**: replace Clerk's branded `<UserButton>` with a fully custom avatar + dropdown that syncs with the app theme and removes Clerk branding.
2. **Display modes for Wishlist and Collection**: support `?display=visual`, `?display=table`, `?display=stacks` (CubeCobra-style) on both pages.
3. **Visual spoiler layout fix**: the wishlist grid renders cards at unequal sizes and overlapping; root-caused and fixed as part of the new visual mode.

## Scope

In scope:

- New `UserMenu` component replacing `UserButton` in the header.
- Display-mode parsing + three view variants on Wishlist (`/src/routes/[id]/+page.svelte`) and Collection (`/src/routes/collection/+page.svelte`).
- Collection API enrichment to expose `card_id` for identity grouping.
- i18n strings (`en.ts`, `pt.ts`).
- Unit tests for display parsing and identity grouping.

Out of scope:

- Display-preference persistence or in-page toggle UI (URL-only, per user).
- Full custom settings/profile route (the Clerk account modal is kept for "Manage account").
- Server-side rendering of card images / image CDN changes.

## Background

### Current user dropdown

`src/lib/components/HeaderNav.svelte` renders `<UserButton appearance={clerkAppearance}>` with a custom menu item (Inbox), the default manage-account and sign-out actions, and a custom profile page (`ProfileInfoPage`) for bio/location/country.

Two defects:

- `svelte-clerk`'s `UserButton` captures its props once at mount (`updatedProps = $state(props)` in the library source), so the `appearance` never updates after mount. Theme changes (light/dark/system) do not reach Clerk's mounted UI.
- Clerk's dropdown footer ("Powered by Clerk") cannot be removed via `appearance` on the free plan.

The `clerk` context exposed by `useClerkContext()` provides everything needed for a custom UI: `user`, `clerk.signOut({ redirectUrl })`, and `clerk.openUserProfile({ customPages })` (confirmed on the `HeadlessBrowserClerk` type).

### Current Wishlist grid

`src/routes/[id]/+page.svelte` renders a responsive grid of card cells. Observed bugs:

1. **Duplicate `{#each}` keys**: after the `/api/prices` fetch, the remap (lines ~97-111) returns cards without `cardPrintingId`, `set`, `collectorNumber`, or `localId`. The grid key `(card.cardPrintingId || card.name)` then collapses to `card.name`, so same-named cards collide. Svelte keyed `{#each}` with duplicate keys misrenders — cards drawn over each other.
2. **`hover:scale-[1.02]`** on the card cell transforms the whole cell and overlaps neighbors on hover.
3. Inline `<img>` elements with mixed provider intrinsic ratios can paint inconsistently before/while lazy-loading.

### Display modes do not exist

No `?display=` handling anywhere. The Wishlist grid is effectively today's visual view; the Collection page shows a `CardRow` list (one row per Have Stack).

## Design 1 — Custom user dropdown (`UserMenu`)

New component `src/lib/components/UserMenu.svelte`, replacing `<UserButton>` in `HeaderNav.svelte`. Removes the `clerkAppearance` block and `UserButton` import. Uses `useClerkContext()` only.

**Avatar button**: `clerkCtx.user.imageUrl` when present; otherwise initials (from `firstName`/`lastName`/`username`/`email`) in a circle. Click toggles the dropdown.

**Dropdown** (opens below the button; closes on Esc, outside click, or navigation):
- Header row: full name + email.
- **Profile** → `resolve('/users/' + user.id)` — the public profile page.
- **Inbox** → `resolve('/inbox')` — preserves the existing custom menu item.
- **Manage account** → `clerk.openUserProfile({ customPages: [...] })`. The custom page mounts `ProfileInfoPage` into Clerk's modal via Svelte `mount`/`unmount`, using the same pattern as svelte-clerk's `UserButtonUserProfilePage` (mount into the provided `el`). Preserves the current bio editor UX.
- **Sign out** → `clerk.signOut({ redirectUrl: resolve('/') })`.

All styling uses app theme tokens (`bg-surface-raised`, `text-text`, `border-border`, etc.), so the dropdown matches light/dark/system automatically. Keyboard/a11y: button + `aria-expanded`, menu items are `<a>` or `<button>`.

Existing `NotificationBell` (signed-in), `LocaleToggle`, `ThemeToggle`, and the mobile nav remain untouched. The dropdown works identically on mobile (renders over content; no horizontal overflow).

## Design 2 — Display modes

### Parsing

New module `src/lib/client/display-mode.ts`:

```ts
export type DisplayMode = 'visual' | 'table' | 'stacks';
export function parseDisplayMode(raw: string | null, fallback: DisplayMode): DisplayMode;
```

Unknown/absent values fall back. Both pages read `$page.url.searchParams.get('display')` reactively (works with client-side navigation and back/forward). No toggle UI, no persistence.

Defaults: Wishlist → `visual`; Collection → `stacks` (current behavior).

### Visual (`?display=visual`)

Spoiler grid of fixed-size card cells:

```
<div class="relative aspect-[5/7] w-full overflow-hidden">   <!-- cell box from aspect-ratio only -->
  <img class="absolute inset-0 h-full w-full object-cover block" />
  qty badge (absolute top-right), name bar below
</div>
```

- Stable unique key per card: `card.cardPrintingId || card.localId || index`.
- Hover effect scales the inner `<img>` only (inside the clipped cell) — never the cell, so nothing overlaps neighbors.
- Wishlist: cell click keeps the existing `PriceTooltip`. Collection: cell click opens `CardEditSheet`.

### Table (`?display=table`)

Client-side sortable table (click header to toggle asc/desc).

- Wishlist columns: Name · Qty · Set · # · Finish · Condition · Language · USD · EUR.
- Collection columns: Name · Qty · Set · # · Finish · Condition · Language · Signed · Altered · Tradeable · USD · EUR; row click opens `CardEditSheet`.

### Stacks (`?display=stacks`)

Grouped by card identity, collapsible. Group key = `card_id` when present, else normalized card name (case/whitespace-insensitive) — backward compatible with unresolved cards.

- Wishlist: group items by identity; header shows card name + total qty; expands to the individual rows (printing/condition/finish/qty).
- Collection: group Have Stacks by identity; header shows name + total qty + stack count; expands to list each stack (condition/finish/signed/altered/qty). Clicking a stack opens `CardEditSheet`.

The grouping helper lives in `src/lib/client/display-mode.ts` as a pure function for unit testing:

```ts
export function groupByCardIdentity<T extends { cardId?: string | null; name: string }>(cards: T[]): T[][];
```

## Design 3 — Visual spoiler fix

Applied to the new visual mode (which replaces the current Wishlist grid rendering):

1. Preserve `cardPrintingId`, `set`, `collectorNumber`, `localId` in the wishlist price-fetch remap; use them for stable `{#each}` keys.
2. Fixed `aspect-[5/7]` cell with absolutely-positioned, `object-cover`, `display:block` image (cell geometry independent of provider image intrinsics).
3. No transform on the cell; hover transform applies to the inner image within the `overflow-hidden` cell.

## Design 4 — Collection API enrichment

In `src/lib/server/services/collection.service.ts` `enrichCards`:

- Change the join select from `cards(name)` to `cards(id, name)` (line ~36).
- Add `cardId: string` to the `CollectionCard` interface and the enriched row mapping.

No repository or DB schema change (the join already passes through `card_printings → cards`).

Wishlist already returns `card_id` from `+page.server.ts`; the page's `LoadedWishlistItem` interface adds `card_id: string` and the derived `cards` mapping surfaces it.

## Design 5 — i18n

Add to `src/lib/i18n/en.ts` and `pt.ts` a `display` namespace: `visual`, `table`, `stacks` labels; column headers (`name`, `qty`, `set`, `collectorNumber`, `finish`, `condition`, `language`, `signed`, `altered`, `tradeable`, `usd`, `eur`); `expand` / `collapse` for stack groups. Reuse existing strings where possible.

## Testing

- `src/lib/__tests__/display-mode.test.ts`: `parseDisplayMode` (valid values pass through; invalid/absent → fallback).
- `src/lib/__tests__/group-by-identity.test.ts`: grouping by `card_id`; name fallback when absent; stable ordering; summed quantities.

## Error handling / edge cases

- Cards without `imageUrl` render a themed placeholder filling the same aspect cell.
- Invalid `?display=` values silently fall back to the page default (no error state).
- `openUserProfile` custom page mount/unmount must clean up the Svelte component on modal close to avoid leaks (mirror svelte-clerk's `mount`/`unmount` pattern).
- Grouping a collection with multiple stacks of the same identity produces one group with the correct stack count and summed quantity.
