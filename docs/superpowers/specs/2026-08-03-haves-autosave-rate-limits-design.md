# Design: Haves Autosave + Provider Rate-Limit Protection

Date: 2026-08-03
Status: Approved (design review)

## Overview

Two related improvements to the collection ("Haves") experience and the card-data API integration:

1. **Autosave for Haves**: persist collection edits automatically instead of requiring a manual Save click.
2. **Provider rate-limit protection**: guard outbound requests to Scryfall / TCGdex / Riftbound against bursts and 429s, and tune the inbound API limiters so heavy endpoints cannot starve lighter ones.

The two are related: autosave fires `POST /api/collection` on its own schedule, which raises the inbound request rate on that route, and autosave's per-card resolution can trigger provider calls. Both changes protect against that load without changing the data model.

## Scope

In scope:

- Collection page (`src/routes/collection/+page.svelte`) autosave behavior.
- Outbound provider request wrapper (pacing, concurrency, retry/backoff) for all three providers.
- Inbound rate-limiter keying and limit tuning.

Out of scope (explicitly excluded by the user):

- Wishlist page autosave.
- Call-count reduction: batching Riftbound/Pokemon `getCardsByIdentifiers`, dedupe, or reviving the DB-backed card cache service.

## Background

### Current Haves flow

- `src/routes/collection/+page.svelte` keeps the entire collection for one game in an in-memory `collectionCards: WishlistCard[]`.
- Add (search select / paste merge), edit, and remove all mutate only the in-memory array.
- A single manual **Save** button calls `POST /api/collection`, which is a **destructive full-replace**: it deletes all `user_cards` rows for the game and re-inserts the sent snapshot (`collection.repository.ts` `replaceCollection`).
- There is no dirty tracking and no autosave anywhere in the app.
- On save, the server resolves each card via `findOrCreateCard` (DB lookup by `normalized_name` + `game_id`; provider call only on a miss) and reports unresolved cards in `data.errors`.

### Current rate limiting

- Inbound: `src/lib/server/middleware/rate-limit.ts` — in-memory fixed-window limiters keyed **by IP only**: `api` 60/min, `save` 10/min, `search` 30/min, `auth` 20/min (unused). Stores are per-process (per Cloudflare Worker isolate).
- Outbound: Scryfall self-throttles ~10/s (fixed 100ms delay) and batches 75/call, but has **no 429/backoff retry**. TCGdex SDK has a 1h in-memory cache but the wrapper loops N sequential calls with no pacing. Riftbound makes single fuzzy calls with no delays/backoff and **silently swallows errors**.

## Design 1 — Autosave for Haves

### Behavior

- Every mutation of `collectionCards` (search select, paste merge, CardEditSheet save/remove, clear, tradeable toggle) marks the snapshot dirty.
- A **2-second debounce** coalesces edits. When the user stops interacting, the page POSTs the **full current array** to the existing `POST /api/collection` (full-snapshot replace).
- **Serialized saves + latest-wins**: never send a save while one is in flight. If the array changes during an in-flight save, schedule exactly one follow-up save with the newest snapshot after the current one completes. Ordering is therefore monotonic; a monotonically increasing sequence number is kept as a secondary guard (a stale response is ignored).
- **Flush on `pagehide`**: if a save is pending, send it with `fetch(..., { keepalive: true })` so the last edit is not lost on navigation/tab close.
- The manual **Save button is removed**. It is replaced by a status pill: `Saving…` / `All changes saved` / error state.
- Partial-resolution errors (cards that could not be resolved) keep the existing banner idiom: "Saved, but N card(s) could not be resolved: …". Resolution is DB-cached after success, so re-saving a fixed collection resolves the previously-missing cards.
- Autosave is disabled until initial `loadCollection()` completes and after a game switch (until reload finishes). `clearCollection()` cancels any pending debounce, performs the DELETE, and marks the snapshot clean.
- Guarded by `currentUserId`; skip saving when signed out.
- On a 429 or 5xx from `POST /api/collection`, the status pill shows an error and the pending snapshot is retained so the next edit retries.

### Testable controller

Extract the debounce/serialize/flush logic into a framework-agnostic controller:

`src/lib/client/autosave.ts`

- `createAutosave({ debounceMs, persist, onState, shouldFlushOnPagehide })` returns a handle with `markDirty()`, `flushNow()`, `dispose()`, and `isSaving`.
- The Svelte component wires `markDirty()` into each mutation and calls `dispose()` on `$effect`/destroy cleanup and game-switch.
- The controller is unit-tested with Vitest fake timers: coalescing, in-flight serialization, latest-wins ordering, pagehide flush, and dispose-cancels-pending.

### Server

`POST /api/collection` logic is unchanged. It moves from the shared `apiRateLimiter` to a dedicated per-user `collectionSaveRateLimiter` (30/min) so autosave cannot starve trades/messages (see Design 3).

### i18n

Add `haves.saving` / `haves.saved` strings to `src/lib/i18n/en.ts` and `pt.ts`.

## Design 2 — Outbound provider protection

New module `src/lib/api/providers/request.ts` (framework-agnostic, unit-testable): a per-provider **pacing + concurrency + retry** wrapper used by all three providers' HTTP calls.

Per provider, configures:

- **minIntervalMs** — minimum gap between request starts (throttle).
- **maxConcurrent** — maximum requests in flight.
- **maxRetries** — retry count for 429 / 5xx / timeout.
- **timeoutMs** — per-request timeout.
- **retryableStatuses** — default `[429, 500, 502, 503, 504]`.

Behavior:

- Requests are paced to start no more often than `minIntervalMs` apart and no more than `maxConcurrent` at once.
- On 429, honor `Retry-After` when present, otherwise fall back to exponential backoff; retry up to `maxRetries`.
- On 5xx or timeout, retry with exponential backoff up to `maxRetries`.
- State is module-level per provider (per-isolate on Cloudflare Workers; documented as such).

Initial config (conservative; TCGdex and Riftbound publish no rate limits):

| Provider  | minIntervalMs | maxConcurrent | maxRetries | timeoutMs |
| --------- | ------------- | ------------- | ---------- | --------- |
| Scryfall  | 100           | 4             | 2          | 10_000    |
| TCGdex    | 150           | 4             | 2          | 10_000    |
| Riftbound | 250           | 2             | 2          | 10_000    |

Refactors:

- `scryfall.ts`: replace ad-hoc `await delay(100)` calls with the wrapper; keep `MAX_BATCH = 75` and the existing `/cards/collection` batching.
- `riftbound.ts`: route `searchCards` and `getCard` through the wrapper. After retry exhaustion, **stop silently swallowing errors** — let the wrapper's `ProviderRequestError` propagate (matching Scryfall's throw behavior) so `/api/cards/lookup` and import can report it.
- `pokemon.ts`: wrap the logical TCGdex SDK calls (`card.get`, `card.list`, `getFullCard`) in the throttle/concurrency/retry wrapper. The SDK's internal detail-fetch is not interceptable; pacing the outer logical calls bounds the request rate. Note this limitation in a comment.

## Design 3 — Inbound limiter tuning

In `src/lib/server/middleware/rate-limit.ts`:

- **Per-user keying**: the limiter function becomes `rateLimit(event, userId?)`. When `userId` is provided, key as `user:${userId}`; otherwise key by IP as today. Routes that already resolve `clerkUserId` pass it. This also removes the fake-`RequestEvent` workaround in `src/routes/api/collection/+server.ts` and `src/routes/api/block/+server.ts`.
- **Dedicated limiters** so heavy routes cannot starve light ones:

  | Limiter                        | Limit  | Routes                                                             |
  | ------------------------------ | ------ | ------------------------------------------------------------------ |
  | `collectionSaveRateLimiter`    | 30/min | `POST /api/collection` (autosave)                                  |
  | `lookupRateLimiter`            | 10/min | `POST /api/cards/lookup`, `POST /api/prices`                       |
  | `searchRateLimiter` (existing) | 30/min | `GET /api/cards/search`, `GET /api/cards/printings`                |
  | `saveRateLimiter` (existing)   | 10/min | `POST /api/import`, `POST /api/save`, `POST /api/collection/merge` |
  | `apiRateLimiter` (existing)    | 60/min | trades, messages, wishlists, ratings, blocks, user endpoints       |

- Remove the unused `authRateLimiter`.
- Document in a comment that in-memory stores are per-isolate on Cloudflare Workers; a durable shared limiter (KV / Durable Object) is future work.

## Error handling

- **Autosave failure**: status pill shows error; dirty snapshot retained; next edit or navigation retries. 429 shows a "rate limited, retrying" state and respects backoff.
- **Provider failure after retry exhaustion**: Riftbound no longer swallows errors. The wrapper throws a typed `ProviderRequestError` after retry exhaustion, which propagates the same way Scryfall's existing throw behavior does (callers surface it as a 500, or `getCard` callers treat it as a lookup failure). The `TcgProvider` return shapes (`TcgSearchResult`, `TcgCard | null`) are unchanged.
- **Unresolved cards**: unchanged behavior — persisted resolved subset + `data.errors` list surfaced in the banner.

## Testing

- `src/lib/__tests__/autosave.test.ts` (new): coalescing, in-flight serialization, latest-wins, pagehide flush, dispose behavior, using fake timers.
- `src/lib/__tests__/provider-request.test.ts` (new): min-gap pacing, concurrency cap, 429 `Retry-After` handling, exponential backoff, retry exhaustion.
- `src/lib/__tests__/rate-limit.test.ts` (extend): per-user keying.
- Existing `riftbound.test.ts` must keep passing (mock `fetch`; the wrapper must accept an injectable fetch for tests).

## Verification

- `npm run test:unit -- --run`
- `npm run check` / `npm run lint` — currently blocked project-wide by a pre-existing TypeScript 7 toolchain incompatibility with `svelte-check`/`typescript-eslint` (unrelated to this work); `npx tsc --noEmit` is the reliable typecheck while that remains.
