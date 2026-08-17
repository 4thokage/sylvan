# Haves Autosave + Provider Rate-Limit Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist collection ("Haves") edits automatically via a debounced full-snapshot save, and protect outbound card-provider API calls plus tune inbound rate limits.

**Architecture:** (1) A framework-agnostic autosave controller (`src/lib/client/autosave.ts`) is wired into the collection page; every edit marks a snapshot dirty, a 2s debounce fires a full-replace `POST /api/collection`, saves are serialized (latest-wins), and a `pagehide`/`dispose` flush covers navigation. (2) A per-provider request limiter (`src/lib/api/providers/request.ts`) adds min-gap pacing, a concurrency cap, 429/5xx retry with backoff, and timeouts to all three providers' HTTP calls. (3) Inbound API limiters get per-user keying and dedicated budgets so heavy routes can't starve light ones.

**Tech Stack:** SvelteKit 2 (Svelte 5 runes), TypeScript 7, Vitest, Scryfall/TCGdex/Riftbound REST APIs, `@tcgdex/sdk`.

## Global Constraints

- Debounce window for Haves autosave is **2000ms**.
- Autosave persists via the existing `POST /api/collection` **full-snapshot replace** (never `merge`).
- The manual Save button on the collection page is **removed**, replaced by a status pill (`Saving…` / `All changes saved` / error).
- No batching, dedupe, or DB cache work: do not change `getCardsByIdentifiers` for Riftbound/Pokemon, do not revive `card-cache.service.ts`.
- Provider pacing config (from spec): Scryfall `minIntervalMs: 100, maxConcurrent: 4, maxRetries: 2, timeoutMs: 10_000`; TCGdex `minIntervalMs: 150, maxConcurrent: 4, maxRetries: 2, timeoutMs: 10_000`; Riftbound `minIntervalMs: 250, maxConcurrent: 2, maxRetries: 2, timeoutMs: 10_000`.
- New inbound limiters (from spec): `collectionSaveRateLimiter` 30/min, `lookupRateLimiter` 10/min. Keep `api` 60/min, `save` 10/min, `search` 30/min. **Remove** the unused `authRateLimiter`.
- Provider failures after retry exhaustion surface via a thrown `ProviderRequestError` (Riftbound must stop swallowing errors); `TcgProvider` return shapes are unchanged.
- In-memory rate-limit stores are per-isolate on Cloudflare Workers; durable shared limiting is future work.
- `npm run check` and `npm run lint` are currently broken project-wide by a pre-existing TypeScript 7 incompatibility with `svelte-check`/`typescript-eslint`. Reliable verification: `npm run test:unit -- --run`, `npx tsc --noEmit -p tsconfig.json`, and `npm run build` (for `.svelte` compile checks).

---

### Task 1: Outbound provider request limiter

**Files:**

- Create: `src/lib/api/providers/request.ts`
- Test: `src/lib/__tests__/provider-request.test.ts`

**Interfaces:**

- Produces:
  - `class ProviderRequestError extends Error` with `readonly provider: string` and `readonly status: number | null`.
  - `createProviderLimiter(provider: string, config: ProviderLimiterConfig, deps?: ProviderLimiterDeps)` returns a `request` function typed `(opts: ProviderRequestOptions) => Promise<Response>` that also carries `withSlot<T>(fn: () => Promise<T>): Promise<T>`.
  - `export const providerLimiters: { scryfall: ...; tcgdex: ...; riftbound: ... }` — module-level singletons used by the three providers in Tasks 2–4.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/provider-request.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createProviderLimiter, ProviderRequestError } from '../api/providers/request';

function mockResponse(status: number, headers: Record<string, string> = {}): Response {
	return {
		status,
		headers: { get: (name: string) => headers[name.toLowerCase()] ?? null }
	} as unknown as Response;
}

function makeLimiter(overrides: Partial<Parameters<typeof createProviderLimiter>[1]> = {}) {
	let clock = 0;
	const sleepCalls: Array<{ ms: number; resolve: () => void }> = [];
	const sleep = (ms: number) =>
		new Promise<void>((resolve) => sleepCalls.push({ ms, resolve: () => resolve() }));
	const fetchImpl = vi.fn();
	const limiter = createProviderLimiter(
		'test',
		{ minIntervalMs: 10, maxConcurrent: 1, maxRetries: 1, timeoutMs: 1000, ...overrides },
		{ fetchImpl, now: () => clock, sleep }
	);
	return { limiter, fetchImpl, sleepCalls, advance: (ms: number) => (clock += ms) };
}

async function tick() {
	await Promise.resolve();
}

describe('createProviderLimiter', () => {
	it('paces requests to a minimum interval', async () => {
		const { limiter, fetchImpl, sleepCalls } = makeLimiter();
		fetchImpl.mockResolvedValue(mockResponse(200));
		await limiter({ url: '/1' });
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		expect(sleepCalls).toHaveLength(0);

		const p2 = limiter({ url: '/2' });
		await tick();
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		expect(sleepCalls).toHaveLength(1);
		expect(sleepCalls[0].ms).toBe(10);
		sleepCalls[0].resolve();
		await p2;
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it('caps concurrent requests', async () => {
		const { limiter, fetchImpl, sleepCalls } = makeLimiter();
		let resolveFirst!: () => void;
		const first = new Promise<Response>((resolve) => {
			resolveFirst = () => resolve(mockResponse(200));
		});
		fetchImpl.mockReturnValueOnce(first).mockResolvedValue(mockResponse(200));

		const p1 = limiter({ url: '/1' });
		await tick();
		expect(fetchImpl).toHaveBeenCalledTimes(1);

		const p2 = limiter({ url: '/2' });
		await tick();
		expect(fetchImpl).toHaveBeenCalledTimes(1);

		resolveFirst();
		await p1;
		await tick();
		expect(sleepCalls).toHaveLength(1);
		sleepCalls[0].resolve();
		await p2;
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it('retries on 429 honoring Retry-After', async () => {
		const { limiter, fetchImpl, sleepCalls } = makeLimiter();
		fetchImpl
			.mockResolvedValueOnce(mockResponse(429, { 'retry-after': '1' }))
			.mockResolvedValueOnce(mockResponse(200));

		const promise = limiter({ url: '/x' });
		await tick();
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		expect(sleepCalls).toHaveLength(1);
		expect(sleepCalls[0].ms).toBe(1000);
		sleepCalls[0].resolve();
		const res = await promise;
		expect(res.status).toBe(200);
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it('throws after retries are exhausted', async () => {
		const { limiter, fetchImpl, sleepCalls } = makeLimiter();
		fetchImpl.mockResolvedValue(mockResponse(429, { 'retry-after': '1' }));

		const promise = limiter({ url: '/x' });
		await tick();
		sleepCalls[0].resolve();
		await tick();
		expect(sleepCalls).toHaveLength(2);
		sleepCalls[1].resolve();
		await expect(promise).rejects.toBeInstanceOf(ProviderRequestError);
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it('backs off exponentially on 5xx', async () => {
		const { limiter, fetchImpl, sleepCalls } = makeLimiter();
		fetchImpl.mockResolvedValueOnce(mockResponse(503)).mockResolvedValueOnce(mockResponse(200));

		const promise = limiter({ url: '/x' });
		await tick();
		expect(sleepCalls).toHaveLength(1);
		expect(sleepCalls[0].ms).toBe(250);
		sleepCalls[0].resolve();
		const res = await promise;
		expect(res.status).toBe(200);
	});

	it('returns non-retryable statuses as-is', async () => {
		const { limiter, fetchImpl } = makeLimiter();
		fetchImpl.mockResolvedValue(mockResponse(404));
		const res = await limiter({ url: '/missing' });
		expect(res.status).toBe(404);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it('times out slow requests', async () => {
		const { limiter, fetchImpl, sleepCalls } = makeLimiter();
		fetchImpl.mockReturnValue(new Promise<Response>(() => {}));

		const promise = limiter({ url: '/slow' });
		await tick();
		expect(sleepCalls).toHaveLength(1);
		expect(sleepCalls[0].ms).toBe(1000);
		sleepCalls[0].resolve();
		await expect(promise).rejects.toBeInstanceOf(ProviderRequestError);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- --run src/lib/__tests__/provider-request.test.ts`
Expected: FAIL with "Cannot find module '../api/providers/request'".

- [ ] **Step 3: Write the implementation**

Create `src/lib/api/providers/request.ts`:

```ts
export interface ProviderRequestOptions {
	url: string;
	method?: 'GET' | 'POST';
	headers?: Record<string, string>;
	body?: string;
}

export interface ProviderLimiterConfig {
	minIntervalMs: number;
	maxConcurrent: number;
	maxRetries: number;
	timeoutMs: number;
	retryableStatuses?: number[];
}

export interface ProviderLimiterDeps {
	fetchImpl?: (input: string, init: RequestInit) => Promise<Response>;
	now?: () => number;
	sleep?: (ms: number) => Promise<void>;
}

export class ProviderRequestError extends Error {
	constructor(
		public readonly provider: string,
		public readonly status: number | null,
		message: string
	) {
		super(message);
		this.name = 'ProviderRequestError';
	}
}

const DEFAULT_RETRYABLE = [429, 500, 502, 503, 504];

export function createProviderLimiter(
	provider: string,
	config: ProviderLimiterConfig,
	deps: ProviderLimiterDeps = {}
) {
	const { maxRetries, timeoutMs } = config;
	const retryable = config.retryableStatuses ?? DEFAULT_RETRYABLE;
	const fetchImpl = deps.fetchImpl ?? ((input: string, init: RequestInit) => fetch(input, init));
	const now = deps.now ?? Date.now;
	const sleep =
		deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

	let lastStartAt = Number.NEGATIVE_INFINITY;
	let inFlight = 0;
	const waiters: Array<() => void> = [];

	async function acquireSlot(): Promise<() => void> {
		while (inFlight >= config.maxConcurrent) {
			await new Promise<void>((resolve) => waiters.push(resolve));
		}
		inFlight++;
		const wait = Math.max(0, lastStartAt + config.minIntervalMs - now());
		if (wait > 0) await sleep(wait);
		lastStartAt = now();
		return () => {
			inFlight--;
			waiters.shift()?.();
		};
	}

	function backoffMs(attempt: number): number {
		return Math.min(250 * Math.pow(2, attempt - 1), 5000);
	}

	async function request(opts: ProviderRequestOptions): Promise<Response> {
		let attempt = 0;
		for (;;) {
			const release = await acquireSlot();
			let response: Response;
			let timedOut = false;
			let settled = false;
			try {
				response = await Promise.race([
					fetchImpl(opts.url, {
						method: opts.method ?? 'GET',
						headers: opts.headers,
						body: opts.body
					}),
					sleep(timeoutMs).then(() => {
						if (!settled) {
							timedOut = true;
							throw new ProviderRequestError(provider, null, `${provider} request timed out`);
						}
					})
				]);
			} catch (err) {
				if (err instanceof ProviderRequestError) throw err;
				timedOut = true;
				response = null as unknown as Response;
			} finally {
				settled = true;
				release();
			}

			attempt++;
			if (!timedOut && !retryable.includes(response.status)) {
				return response;
			}
			if (attempt > maxRetries) {
				if (timedOut) {
					throw new ProviderRequestError(provider, null, `${provider} request timed out`);
				}
				throw new ProviderRequestError(
					provider,
					response.status,
					`${provider} request failed with status ${response.status}`
				);
			}
			let waitMs: number;
			if (!timedOut && response.status === 429) {
				const retryAfter = response.headers.get('retry-after');
				waitMs = retryAfter ? Math.max(Number(retryAfter) * 1000, 250) : backoffMs(attempt);
			} else {
				waitMs = backoffMs(attempt);
			}
			await sleep(waitMs);
		}
	}

	async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
		const release = await acquireSlot();
		try {
			return await fn();
		} finally {
			release();
		}
	}

	return Object.assign(request, { withSlot });
}

export const providerLimiters = {
	scryfall: createProviderLimiter('scryfall', {
		minIntervalMs: 100,
		maxConcurrent: 4,
		maxRetries: 2,
		timeoutMs: 10_000
	}),
	tcgdex: createProviderLimiter('tcgdex', {
		minIntervalMs: 150,
		maxConcurrent: 4,
		maxRetries: 2,
		timeoutMs: 10_000
	}),
	riftbound: createProviderLimiter('riftbound', {
		minIntervalMs: 250,
		maxConcurrent: 2,
		maxRetries: 2,
		timeoutMs: 10_000
	})
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- --run src/lib/__tests__/provider-request.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/providers/request.ts src/lib/__tests__/provider-request.test.ts
git commit -m "feat: add per-provider outbound request limiter with retry/backoff"
```

---

### Task 2: Route Scryfall provider through the limiter

**Files:**

- Modify: `src/lib/api/providers/scryfall.ts`

**Interfaces:**

- Consumes: `providerLimiters.scryfall` from `./request` (Task 1), used as `await providerLimiters.scryfall({ url, method?, headers?, body? })` returning `Promise<Response>` (throws `ProviderRequestError` after retries).

- [ ] **Step 1: Update the file**

Add the import at the top of `src/lib/api/providers/scryfall.ts` (after line 1):

```ts
import { providerLimiters } from './request';
```

Delete these two lines (no longer needed):

```ts
const MAX_BATCH = 75;
const RATE_LIMIT_MS = 100;
```

Delete the `delay` helper (lines 56–58):

```ts
async function delay(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}
```

`searchCards` (lines 193–220) — replace the fetch preamble:

```ts
	async searchCards(
		query: string,
		limit = 25
	): Promise<{ cards: TcgCard[]; totalCount: number; hasMore: boolean }> {
		const response = await providerLimiters.scryfall({
			url: `${API_BASE}/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=released&dir=desc`,
			headers: HEADERS
		});
```

`fuzzySearchCard` (lines 222–232) — replace the fetch preamble:

```ts
	async fuzzySearchCard(name: string): Promise<TcgCard | null> {
		const response = await providerLimiters.scryfall({
			url: `${API_BASE}/cards/named?fuzzy=${encodeURIComponent(name)}`,
			headers: HEADERS
		});
```

`getCard` (lines 234–249) — replace the fetch preamble (keep the URL-building lines above it):

```ts
const response = await providerLimiters.scryfall({
	url,
	headers: HEADERS
});
```

`getCardsByIdentifiers` (lines 251–286) — replace the loop body:

```ts
	async getCardsByIdentifiers(
		identifiers: Array<{ name: string; set?: string; collectorNumber?: string }>
	): Promise<TcgCard[]> {
		const allCards: TcgCard[] = [];

		for (let i = 0; i < identifiers.length; i += MAX_BATCH) {
			const batch = identifiers.slice(i, i + MAX_BATCH);
			const response = await providerLimiters.scryfall({
				url: `${API_BASE}/cards/collection`,
				method: 'POST',
				headers: HEADERS,
				body: JSON.stringify({
					identifiers: batch.map((id) => ({
						name: id.name,
						...(id.set && { set: id.set.toLowerCase() }),
						...(id.collectorNumber && { collector_number: id.collectorNumber })
					}))
				})
			});

			if (!response.ok) {
				throw new Error(`Scryfall collection failed: ${response.status}`);
			}

			const data = await response.json();
			for (const raw of data.data || []) {
				for (const card of splitFinishes(raw)) {
					allCards.push(card);
				}
			}
		}

		return allCards;
	},
```

`getAllPrintings` (lines 288–317) — replace the fetch preamble inside the while loop:

```ts
		while (hasMore) {
			const response = await providerLimiters.scryfall({
				url: `${API_BASE}/cards/search?q=${encodeURIComponent(cardName)}&unique=prints&order=released&dir=desc&page=${page}`,
				headers: HEADERS
			});
```

(Keep all the `if (!response.ok)` blocks — 429s are now retried by the limiter, but the generic failure throw stays.)

- [ ] **Step 2: Verify compilation and tests**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: EXIT 0 (no errors).

Run: `npm run test:unit -- --run`
Expected: all existing tests still PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/providers/scryfall.ts
git commit -m "refactor: route scryfall provider through outbound request limiter"
```

---

### Task 3: Route Riftbound provider through the limiter and stop swallowing errors

**Files:**

- Modify: `src/lib/api/providers/riftbound.ts`
- Modify: `src/lib/__tests__/riftbound.test.ts`

**Interfaces:**

- Consumes: `providerLimiters.riftbound` from `./request` (Task 1).
- Note: Riftbound tests share one module-level limiter; with a 250ms min gap, test 2+ each incur ~250ms real time. Accept this (~2s total in the file). Update the mock to include `status` and `headers` for realism.

- [ ] **Step 1: Update the provider**

Add the import at the top of `src/lib/api/providers/riftbound.ts` (after line 1):

```ts
import { providerLimiters } from './request';
```

Replace `searchCards` (lines 110–131) with:

```ts
	async searchCards(
		query: string,
		limit = 25
	): Promise<{ cards: TcgCard[]; totalCount: number; hasMore: boolean }> {
		const response = await providerLimiters.riftbound({
			url: `${API_BASE}/cards/name?fuzzy=${encodeURIComponent(query)}&size=${limit}`,
			headers: HEADERS
		});
		if (!response.ok) {
			return { cards: [], totalCount: 0, hasMore: false };
		}
		const data = await response.json();
		const items = Array.isArray(data) ? data : data.items || [];
		const cards = items.map(mapToTcgCard);
		const totalCount = data.total ?? items.length;
		const hasMore =
			data.page != null && data.pages != null ? data.page < data.pages : false;
		return { cards, totalCount, hasMore };
	},
```

Replace `getCard` (lines 135–151) with (note: no try/catch — the limiter throws `ProviderRequestError` after retries, which propagates like Scryfall):

```ts
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async getCard(name: string, _set?: string, _collectorNumber?: string): Promise<TcgCard | null> {
		const response = await providerLimiters.riftbound({
			url: `${API_BASE}/cards/name?fuzzy=${encodeURIComponent(name)}`,
			headers: HEADERS
		});
		if (!response.ok) return null;
		const data = await response.json();
		const raw = Array.isArray(data) ? data[0] : data.items?.[0];
		if (!raw) return null;
		return mapToTcgCard(raw);
	},
```

- [ ] **Step 2: Update the tests**

In `src/lib/__tests__/riftbound.test.ts`, change `mockFetchOnce` so mocked responses carry `status` and `headers` (the limiter reads them):

```ts
function mockFetchOnce(body: unknown, ok = true) {
	vi.stubGlobal(
		'fetch',
		vi.fn().mockResolvedValue({
			ok,
			status: ok ? 200 : 500,
			headers: { get: () => null },
			json: vi.fn().mockResolvedValue(body)
		})
	);
}
```

- [ ] **Step 3: Verify**

Run: `npm run test:unit -- --run src/lib/__tests__/riftbound.test.ts`
Expected: PASS (9 tests). The file adds ~2s of real pacing time; that is expected.

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: EXIT 0.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api/providers/riftbound.ts src/lib/__tests__/riftbound.test.ts
git commit -m "refactor: route riftbound provider through limiter, stop swallowing provider errors"
```

---

### Task 4: Pace TCGdex provider calls

**Files:**

- Modify: `src/lib/api/providers/pokemon.ts`

**Interfaces:**

- Consumes: `providerLimiters.tcgdex.withSlot<T>(fn)` from `./request` (Task 1). The TCGdex SDK's internal HTTP is not interceptable; pacing the outer logical calls bounds request rate.

- [ ] **Step 1: Update the file**

Add the import and a helper at the top of `src/lib/api/providers/pokemon.ts` (after line 2):

```ts
import { providerLimiters } from './request';
```

Add after the `getFullCard` helper (lines 127–132):

```ts
// The TCGdex SDK performs its own internal HTTP requests, which are not
// interceptable. Pacing the outer logical calls still bounds our request rate.
async function paced<T>(fn: () => Promise<T>): Promise<T> {
	return providerLimiters.tcgdex.withSlot(fn);
}
```

Wrap each SDK call site:

In `searchCards` (lines 140–157):

```ts
const results = await paced(() => tcgdex.card.list(q));
const cards: TcgCard[] = [];
for (const r of results.slice(0, limit)) {
	const full = await paced(() => getFullCard(r));
	for (const card of splitFinishes(full)) {
		cards.push(card);
	}
}
```

In `getCard` (lines 163–183):

```ts
if (set && collectorNumber) {
	const id = `${set.toLowerCase()}-${collectorNumber}`;
	const card = await paced(() => tcgdex.card.get(id));
	if (card) {
		const full = await paced(() => getFullCard(card));
		const variants = Array.from(splitFinishes(full));
		return variants[0] || null;
	}
}
let q = Query.create().equal('name', name).paginate(1, 1);
let results = await paced(() => tcgdex.card.list(q));
if (results.length === 0) {
	q = Query.create().contains('name', name).paginate(1, 1);
	results = await paced(() => tcgdex.card.list(q));
}
if (results.length === 0) return null;
const full = await paced(() => getFullCard(results[0]));
```

In `getAllPrintings` (lines 196–211):

```ts
let q = Query.create().equal('name', cardName).sort('set.releaseDate', 'DESC');
let results = await paced(() => tcgdex.card.list(q));
if (results.length === 0) {
	q = Query.create().contains('name', cardName).sort('set.releaseDate', 'DESC');
	results = await paced(() => tcgdex.card.list(q));
}
const printings: TcgPrinting[] = [];
for (const r of results) {
	const full = await paced(() => getFullCard(r));
	for (const printing of splitPrintings(full)) {
		printings.push(printing);
	}
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: EXIT 0.

Run: `npm run test:unit -- --run`
Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/providers/pokemon.ts
git commit -m "refactor: pace tcgdex provider calls through outbound request limiter"
```

---

### Task 5: Inbound rate limiter per-user keying and dedicated budgets

**Files:**

- Modify: `src/lib/server/middleware/rate-limit.ts`
- Modify: `src/lib/__tests__/rate-limit.test.ts`

**Interfaces:**

- Produces: limiter functions keep the signature `(event: RequestEvent, userKey?: string | null) => { passed, remaining, resetAt }`. New exports: `lookupRateLimiter`, `collectionSaveRateLimiter`. `authRateLimiter` is removed.

- [ ] **Step 1: Update the limiter**

In `src/lib/server/middleware/rate-limit.ts`, change the returned function signature and key computation (lines 32–41):

```ts
	return function rateLimit(event: RequestEvent, userKey?: string | null): {
		passed: boolean;
		remaining: number;
		resetAt: number;
	} {
		const ip =
			event.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
			event.getClientAddress() ||
			'unknown';
		const key = userKey ? `user:${userKey}` : ip;
```

(The `const key = ip;` line at line 41 is replaced by the above `key` computation.)

Replace the limiter exports (lines 60–63) with:

```ts
export const apiRateLimiter = createRateLimiter('api', { windowMs: 60_000, maxRequests: 60 });
export const saveRateLimiter = createRateLimiter('save', { windowMs: 60_000, maxRequests: 10 });
export const searchRateLimiter = createRateLimiter('search', { windowMs: 60_000, maxRequests: 30 });
export const lookupRateLimiter = createRateLimiter('lookup', { windowMs: 60_000, maxRequests: 10 });
export const collectionSaveRateLimiter = createRateLimiter('collectionSave', {
	windowMs: 60_000,
	maxRequests: 30
});
```

Note: `authRateLimiter` is removed. `npm run lint` cannot currently verify this (TS7 blocker), so grep after editing:

```bash
grep -rn "authRateLimiter" src/ || echo "no references"
```

Expected: `no references`.

- [ ] **Step 2: Extend the tests**

Append to `src/lib/__tests__/rate-limit.test.ts` inside the existing `describe('createRateLimiter', ...)` block:

```ts
it('keys by user id when provided', () => {
	const limiter = createRateLimiter('testUser', { windowMs: 60000, maxRequests: 2 });
	expect(limiter(mockRequest('1.1.1.1'), 'user-a').passed).toBe(true);
	expect(limiter(mockRequest('2.2.2.2'), 'user-a').passed).toBe(true);
	expect(limiter(mockRequest('3.3.3.3'), 'user-a').passed).toBe(false);
	expect(limiter(mockRequest('1.1.1.1'), 'user-b').passed).toBe(true);
});

it('falls back to IP when no user id', () => {
	const limiter = createRateLimiter('testAnon', { windowMs: 60000, maxRequests: 1 });
	expect(limiter(mockRequest('1.1.1.1')).passed).toBe(true);
	expect(limiter(mockRequest('1.1.1.1')).passed).toBe(false);
});
```

- [ ] **Step 3: Verify**

Run: `npm run test:unit -- --run src/lib/__tests__/rate-limit.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/middleware/rate-limit.ts src/lib/__tests__/rate-limit.test.ts
git commit -m "feat: per-user inbound rate-limit keying and dedicated lookup/collection-save budgets"
```

---

### Task 6: Apply new limiters to API routes

**Files:**

- Modify: `src/routes/api/collection/+server.ts`
- Modify: `src/routes/api/block/+server.ts`
- Modify: `src/routes/api/cards/lookup/+server.ts`
- Modify: `src/routes/api/prices/+server.ts`
- Modify: `src/routes/api/import/+server.ts`

**Interfaces:**

- Consumes: `lookupRateLimiter`, `collectionSaveRateLimiter` from Task 5; existing `saveRateLimiter` now accepts `(event, userKey)`.

- [ ] **Step 1: Collection POST → dedicated limiter, per-user key**

In `src/routes/api/collection/+server.ts`:

- Remove line 2 (`import type { RequestEvent } from '@sveltejs/kit';`).
- Change the import on line 4 to:

```ts
import { collectionSaveRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
```

- Replace lines 101–105 with:

```ts
const rateCheck = collectionSaveRateLimiter(event, clerkUserId);
if (!rateCheck.passed) return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);
```

- [ ] **Step 2: Block POST → per-user key**

In `src/routes/api/block/+server.ts`:

- Remove line 2 (`import type { RequestEvent } from '@sveltejs/kit';`).
- Replace lines 39–43 with:

```ts
const rateCheck = apiRateLimiter(event, clerkUserId);
if (!rateCheck.passed) return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);
```

- [ ] **Step 3: Lookup and prices → dedicated lookup limiter**

In `src/routes/api/cards/lookup/+server.ts`, change line 3 to:

```ts
import { lookupRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
```

and line 9 to:

```ts
const rateCheck = lookupRateLimiter(event);
```

In `src/routes/api/prices/+server.ts`, change line 4 to:

```ts
import { lookupRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
```

and line 9 to:

```ts
const rateCheck = lookupRateLimiter(event);
```

- [ ] **Step 4: Import → per-user key**

In `src/routes/api/import/+server.ts`, change line 15 to:

```ts
const rateCheck = saveRateLimiter(event, clerkUserId);
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: EXIT 0.

Run: `npm run test:unit -- --run`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/api/collection/+server.ts src/routes/api/block/+server.ts src/routes/api/cards/lookup/+server.ts src/routes/api/prices/+server.ts src/routes/api/import/+server.ts
git commit -m "feat: apply per-user and dedicated rate limits to collection, lookup, prices, import, block routes"
```

---

### Task 7: Autosave controller

**Files:**

- Create: `src/lib/client/autosave.ts`
- Test: `src/lib/__tests__/autosave.test.ts`

**Interfaces:**

- Produces:
  - `type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'`
  - `interface AutosaveState { status: AutosaveStatus; error: string | null }`
  - `interface AutosaveOptions { debounceMs?: number; persist: (snapshot: unknown) => Promise<void>; onState?: (state: AutosaveState) => void; flushOnPagehide?: boolean; flushTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'> | null }`
  - `interface AutosaveHandle { markDirty(snapshot: unknown): void; flushNow(): Promise<void>; cancelPending(): void; dispose(): void }`
  - `createAutosave(options: AutosaveOptions): AutosaveHandle`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/autosave.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createAutosave } from '../client/autosave';

function flush(ms = 0) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

class MockEmitter {
	listeners = new Map<string, () => void>();
	addEventListener(type: string, fn: () => void) {
		this.listeners.set(type, fn);
	}
	removeEventListener(type: string, _fn: () => void) {
		this.listeners.delete(type);
	}
	emit(type: string) {
		this.listeners.get(type)?.();
	}
}

describe('createAutosave', () => {
	it('persists a snapshot after the debounce window', async () => {
		const persist = vi.fn().mockResolvedValue(undefined);
		const autosave = createAutosave({ debounceMs: 20, persist, flushTarget: null });
		autosave.markDirty([{ name: 'A' }]);
		expect(persist).not.toHaveBeenCalled();
		await flush(40);
		expect(persist).toHaveBeenCalledWith([{ name: 'A' }]);
		autosave.dispose();
	});

	it('coalesces rapid edits into a single save with the latest snapshot', async () => {
		const persist = vi.fn().mockResolvedValue(undefined);
		const autosave = createAutosave({ debounceMs: 20, persist, flushTarget: null });
		autosave.markDirty([{ name: 'A' }]);
		autosave.markDirty([{ name: 'A' }, { name: 'B' }]);
		autosave.markDirty([{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
		await flush(40);
		expect(persist).toHaveBeenCalledTimes(1);
		expect(persist).toHaveBeenCalledWith([{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
		autosave.dispose();
	});

	it('serializes saves and sends a follow-up when edits arrive mid-save', async () => {
		let resolveSave!: () => void;
		const persist = vi.fn().mockImplementation(
			(snapshot: unknown) =>
				new Promise<void>((resolve) => {
					resolveSave = () => resolve();
				}) && Promise.resolve()
		);
		const autosave = createAutosave({ debounceMs: 20, persist, flushTarget: null });
		autosave.markDirty([{ name: 'A' }]);
		await flush(40);
		expect(persist).toHaveBeenCalledTimes(1);

		autosave.markDirty([{ name: 'A' }, { name: 'B' }]);
		resolveSave();
		await flush(40);
		expect(persist).toHaveBeenCalledTimes(2);
		expect(persist).toHaveBeenLastCalledWith([{ name: 'A' }, { name: 'B' }]);
		autosave.dispose();
	});

	it('reports errors and retries on the next edit', async () => {
		const persist = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);
		const states: string[] = [];
		const autosave = createAutosave({
			debounceMs: 20,
			persist,
			flushTarget: null,
			onState: (s) => states.push(s.status)
		});
		autosave.markDirty([{ name: 'A' }]);
		await flush(40);
		expect(states).toContain('error');
		autosave.markDirty([{ name: 'A' }, { name: 'B' }]);
		await flush(40);
		expect(persist).toHaveBeenCalledTimes(2);
		expect(states).toContain('saved');
		autosave.dispose();
	});

	it('flushNow persists immediately', async () => {
		const persist = vi.fn().mockResolvedValue(undefined);
		const autosave = createAutosave({ debounceMs: 1000, persist, flushTarget: null });
		autosave.markDirty([{ name: 'A' }]);
		await autosave.flushNow();
		expect(persist).toHaveBeenCalledTimes(1);
		expect(persist).toHaveBeenCalledWith([{ name: 'A' }]);
		autosave.dispose();
	});

	it('cancelPending drops a pending save', async () => {
		const persist = vi.fn().mockResolvedValue(undefined);
		const autosave = createAutosave({ debounceMs: 20, persist, flushTarget: null });
		autosave.markDirty([{ name: 'A' }]);
		autosave.cancelPending();
		await flush(40);
		expect(persist).not.toHaveBeenCalled();
		autosave.dispose();
	});

	it('dispose cancels a pending save', async () => {
		const persist = vi.fn().mockResolvedValue(undefined);
		const autosave = createAutosave({ debounceMs: 20, persist, flushTarget: null });
		autosave.markDirty([{ name: 'A' }]);
		autosave.dispose();
		await flush(40);
		expect(persist).not.toHaveBeenCalled();
	});

	it('flushes a dirty snapshot on pagehide', async () => {
		const emitter = new MockEmitter();
		const persist = vi.fn().mockResolvedValue(undefined);
		const autosave = createAutosave({ debounceMs: 1000, persist, flushTarget: emitter });
		autosave.markDirty([{ name: 'A' }]);
		emitter.emit('pagehide');
		await flush(10);
		expect(persist).toHaveBeenCalledWith([{ name: 'A' }]);
		autosave.dispose();
	});
});
```

Note: the mid-save test's `persist` mock uses an awkward `&&` expression to return a promise and capture the resolver; replace it with the clearer form:

```ts
const persist = vi.fn().mockImplementation(
	() =>
		new Promise<void>((resolve) => {
			resolveSave = () => resolve();
		})
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- --run src/lib/__tests__/autosave.test.ts`
Expected: FAIL with "Cannot find module '../client/autosave'".

- [ ] **Step 3: Write the implementation**

Create `src/lib/client/autosave.ts`:

```ts
export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface AutosaveState {
	status: AutosaveStatus;
	error: string | null;
}

export interface AutosaveOptions {
	debounceMs?: number;
	persist: (snapshot: unknown) => Promise<void>;
	onState?: (state: AutosaveState) => void;
	flushOnPagehide?: boolean;
	flushTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'> | null;
}

export interface AutosaveHandle {
	markDirty(snapshot: unknown): void;
	flushNow(): Promise<void>;
	cancelPending(): void;
	dispose(): void;
}

export function createAutosave(options: AutosaveOptions): AutosaveHandle {
	const {
		debounceMs = 2000,
		persist,
		onState,
		flushOnPagehide = true,
		flushTarget = typeof window !== 'undefined' ? window : null
	} = options;

	let latestSnapshot: unknown = null;
	let dirty = false;
	let saving = false;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let disposed = false;

	const state: AutosaveState = { status: 'idle', error: null };

	function emit(next: Partial<AutosaveState>) {
		state.status = next.status ?? state.status;
		state.error = next.error !== undefined ? next.error : state.error;
		onState?.({ status: state.status, error: state.error });
	}

	function clearTimer() {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
	}

	function schedule() {
		if (disposed) return;
		clearTimer();
		timer = setTimeout(() => {
			timer = null;
			void runSave();
		}, debounceMs);
	}

	async function runSave(): Promise<void> {
		if (disposed || saving || !dirty || latestSnapshot === null) return;
		saving = true;
		emit({ status: 'saving', error: null });
		const snapshot = latestSnapshot;
		let ok = false;
		try {
			await persist(snapshot);
			ok = true;
		} catch (err) {
			emit({
				status: 'error',
				error: err instanceof Error ? err.message : 'Autosave failed'
			});
		} finally {
			saving = false;
		}
		if (!ok) return;
		if (latestSnapshot !== snapshot) {
			schedule();
		} else {
			dirty = false;
			emit({ status: 'saved', error: null });
		}
	}

	function onPagehide() {
		if (dirty && latestSnapshot !== null) {
			dirty = false;
			void persist(latestSnapshot).catch(() => {});
		}
	}

	function markDirty(snapshot: unknown) {
		if (disposed) return;
		latestSnapshot = snapshot;
		dirty = true;
		emit({ status: 'idle', error: null });
		schedule();
	}

	async function flushNow(): Promise<void> {
		if (disposed) return;
		clearTimer();
		if (!dirty || latestSnapshot === null) return;
		await runSave();
	}

	function cancelPending() {
		if (disposed) return;
		clearTimer();
		dirty = false;
		latestSnapshot = null;
	}

	function dispose() {
		if (disposed) return;
		disposed = true;
		clearTimer();
		if (flushOnPagehide && flushTarget) {
			flushTarget.removeEventListener('pagehide', onPagehide);
		}
		if (dirty && latestSnapshot !== null) {
			dirty = false;
			void persist(latestSnapshot).catch(() => {});
		}
	}

	if (flushOnPagehide && flushTarget) {
		flushTarget.addEventListener('pagehide', onPagehide);
	}

	return { markDirty, flushNow, cancelPending, dispose };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- --run src/lib/__tests__/autosave.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/client/autosave.ts src/lib/__tests__/autosave.test.ts
git commit -m "feat: add debounced autosave controller with latest-wins serialization"
```

---

### Task 8: Wire autosave into the collection page and i18n

**Files:**

- Modify: `src/routes/collection/+page.svelte`
- Modify: `src/lib/i18n/en.ts`
- Modify: `src/lib/i18n/pt.ts`

**Interfaces:**

- Consumes: `createAutosave`, `AutosaveState`, `AutosaveHandle` from Task 7; `collectionSaveRateLimiter` on the server (Task 6) is already wired.

- [ ] **Step 1: Add i18n strings**

In `src/lib/i18n/en.ts`, in the `haves` block (lines 36–61), replace:

```ts
		save: 'Save',
		saving: 'Saving...',
```

with:

```ts
		saving: 'Saving...',
		saved: 'All changes saved',
		saveError: 'Could not save changes',
```

In `src/lib/i18n/pt.ts`, in the `haves` block (lines 38–52), replace:

```ts
		save: 'Salvar',
		saving: 'Salvando...',
```

with:

```ts
		saving: 'Salvando...',
		saved: 'Todas as alterações salvas',
		saveError: 'Não foi possível salvar as alterações',
```

- [ ] **Step 2: Update the collection page script**

In `src/routes/collection/+page.svelte`:

Add imports after line 7:

```ts
import { createAutosave } from '$lib/client/autosave';
import type { AutosaveHandle, AutosaveState } from '$lib/client/autosave';
```

Replace the state block (lines 9–17) so `isSaving` becomes autosave state:

```ts
let input = $state('');
let collectionCards = $state<WishlistCard[]>([]);
let isLoading = $state(false);
let isLoadingCollection = $state(true);
let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);
let autosave = $state<AutosaveHandle | null>(null);
let autosaveState = $state<AutosaveState>({ status: 'idle', error: null });
let selectedGame = $state('mtg');
let selectedCard = $state<WishlistCard | null>(null);
let isDrawerOpen = $state(false);
```

Replace the `saveCollection` function (lines 132–181) with:

```ts
function cardToSavePayload(card: WishlistCard) {
	return {
		name: card.name,
		qty: card.qty,
		cardPrintingId: card.cardPrintingId || null,
		set: card.set,
		collector_number: card.collectorNumber,
		condition: card.condition,
		finish: card.finish,
		aftermarketSigned: card.aftermarketSigned,
		isAltered: card.isAltered,
		isTradeable: card.isTradeable,
		language: card.language,
		location: null,
		notes: null
	};
}

async function persistCollection(snapshot: WishlistCard[], game: string) {
	if (!currentUserId) return;
	const response = await fetch('/api/collection', {
		method: 'POST',
		keepalive: true,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ cards: snapshot.map(cardToSavePayload), gameSlug: game })
	});
	const result = await response.json();
	if (!result.success) {
		throw new Error(result.error?.message || 'Failed to save');
	}
	const errors: string[] = result.data?.errors || [];
	if (errors.length > 0) {
		message = {
			type: 'error',
			text: `Saved, but ${errors.length} card(s) could not be resolved: ${errors
				.slice(0, 3)
				.join(', ')}${errors.length > 3 ? '…' : ''}`
		};
	}
}

$effect(() => {
	if (!isSignedIn) {
		autosave?.dispose();
		autosave = null;
		return;
	}
	if (!autosave) {
		autosave = createAutosave({
			debounceMs: 2000,
			persist: (snapshot) => persistCollection(snapshot as WishlistCard[], selectedGame),
			onState: (s) => {
				autosaveState = s;
			}
		});
	}
	return () => {
		autosave?.dispose();
		autosave = null;
	};
});
```

Replace `clearCollection` (lines 183–193) to cancel pending autosave before the DELETE:

```ts
async function clearCollection() {
	autosave?.cancelPending();
	try {
		await fetch(`/api/collection?game=${selectedGame}`, { method: 'DELETE' });
		collectionCards = [];
		input = '';
		message = { type: 'success', text: 'Collection cleared!' };
		setTimeout(() => (message = null), 3000);
	} catch {
		message = { type: 'error', text: 'Failed to clear collection' };
	}
}
```

In `handleAdd`, after `collectionCards = Array.from(existingMap.values());` (line 247), add:

```ts
autosave?.markDirty(collectionCards);
```

In `addCardFromSearch` (lines 268–278), at the end of the function body (after the `setTimeout` line), add:

```ts
autosave?.markDirty(collectionCards);
```

In `handleSaveCard` (lines 310–314), after `collectionCards = collectionCards.map(...)`, add:

```ts
autosave?.markDirty(collectionCards);
```

In `handleRemoveCard` (lines 316–321), after `collectionCards = collectionCards.filter(...)`, add:

```ts
autosave?.markDirty(collectionCards);
```

Replace `switchGame` (lines 323–330) to flush and cancel before switching:

```ts
async function switchGame(game: string) {
	if (game === selectedGame) return;
	if (autosave) {
		await autosave.flushNow();
		autosave.cancelPending();
	}
	selectedGame = game;
	collectionCards = [];
	isLoadingCollection = true;
	if (isSignedIn) {
		await loadCollection();
	}
}
```

- [ ] **Step 3: Replace the Save button with a status pill**

In the markup (lines 373–379), replace:

```svelte
<button
	onclick={saveCollection}
	disabled={isSaving || collectionCards.length === 0}
	class="rounded-lg bg-accent-bg px-6 py-2 font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-hover"
>
	{isSaving ? t($localeStore, 'haves.saving') : t($localeStore, 'haves.save')}
</button>
```

with:

```svelte
{#if autosaveState.status === 'saving'}
	<span
		class="inline-flex items-center gap-2 rounded-lg border border-border-strong px-3 py-2 text-sm text-text-soft"
	>
		<span
			class="h-3 w-3 animate-spin rounded-full border-2 border-border-strong border-t-emerald-500"
		></span>
		{t($localeStore, 'haves.saving')}
	</span>
{:else if autosaveState.status === 'saved'}
	<span class="rounded-lg border border-border-strong px-3 py-2 text-sm text-text-muted">
		{t($localeStore, 'haves.saved')}
	</span>
{:else if autosaveState.status === 'error'}
	<span
		class="rounded-lg border border-danger-bg px-3 py-2 text-sm text-danger"
		title={autosaveState.error || ''}
	>
		{t($localeStore, 'haves.saveError')}
	</span>
{/if}
```

- [ ] **Step 4: Verify no stale references**

```bash
grep -rn "saveCollection\|isSaving\|haves\.save'" src/routes/collection/+page.svelte src/lib/i18n/
```

Expected: only the new `haves.saving`/`haves.saved`/`haves.saveError` references; no `saveCollection`, no `isSaving`, no `haves.save'`.

Run: `npm run build`
Expected: build completes (this compile-checks the `.svelte` changes; `npm run check` is blocked by the TS7 toolchain issue).

- [ ] **Step 5: Commit**

```bash
git add src/routes/collection/+page.svelte src/lib/i18n/en.ts src/lib/i18n/pt.ts
git commit -m "feat: autosave Haves with status pill, replacing manual save button"
```

---

### Task 9: Final verification

**Files:** none.

- [ ] **Step 1: Full test suite**

Run: `npm run test:unit -- --run`
Expected: all test files PASS (provider-request, autosave, rate-limit, riftbound, parser, plus any existing).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: EXIT 0.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Formatting (changed files only)**

Run:

```bash
npx prettier --write src/lib/api/providers/request.ts src/lib/api/providers/scryfall.ts src/lib/api/providers/riftbound.ts src/lib/api/providers/pokemon.ts src/lib/server/middleware/rate-limit.ts src/lib/client/autosave.ts src/routes/collection/+page.svelte src/lib/i18n/en.ts src/lib/i18n/pt.ts src/routes/api/collection/+server.ts src/routes/api/block/+server.ts src/routes/api/cards/lookup/+server.ts src/routes/api/prices/+server.ts src/routes/api/import/+server.ts src/lib/__tests__/provider-request.test.ts src/lib/__tests__/autosave.test.ts src/lib/__tests__/rate-limit.test.ts src/lib/__tests__/riftbound.test.ts
```

Then re-run `npm run test:unit -- --run` and `npx tsc --noEmit -p tsconfig.json` to confirm formatting didn't break anything.

- [ ] **Step 5: Final commit (if formatting produced changes)**

```bash
git add -A
git commit -m "chore: format autosave and rate-limit changes"
```

---

## Self-Review Notes

- **Spec coverage:** Design 1 (autosave) → Tasks 7–8; Design 2 (outbound wrapper) → Tasks 1–4; Design 3 (inbound tuning) → Tasks 5–6. Error-handling rules (Riftbound stops swallowing, `ProviderRequestError` propagation, unresolved-card banner) covered in Tasks 1/3/8. i18n in Task 8. Tests per spec in Tasks 1/5/7 plus existing riftbound tests.
- **Placeholders:** none; every step includes concrete code or exact commands.
- **Type consistency:** `createProviderLimiter` returns `request` carrying `withSlot`; `providerLimiters.{scryfall,tcgdex,riftbound}` consumed in Tasks 2–4 match. `createAutosave` returns `{ markDirty, flushNow, cancelPending, dispose }`; `AutosaveHandle`/`AutosaveState` consumed in Task 8 match. Limiter signature `(event, userKey?)` consistent across Tasks 5–6.
