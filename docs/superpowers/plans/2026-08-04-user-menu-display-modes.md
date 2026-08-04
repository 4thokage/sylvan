# Custom User Menu + Display Modes + Visual Spoiler Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Clerk's branded `<UserButton>` with a theme-synced custom dropdown, add `?display=visual|table|stacks` modes to Wishlist and Collection, and fix the visual-spoiler layout/overlap bug.

**Architecture:** A new `UserMenu` component built purely on `useClerkContext()` (avatar, dropdown, `clerk.openUserProfile` with a Svelte-mounted custom page, `clerk.signOut`). Display mode is parsed from the URL query param by a small pure helper module; each page renders three view variants (visual grid, sortable `CardTable`, identity-grouped collapsible stacks). The collection API gains `cardId` for canonical identity grouping.

**Tech Stack:** Svelte 5 (runes), svelte-clerk, Tailwind CSS 4, SvelteKit, Vitest.

## Global Constraints

- No new dependencies.
- No DB schema changes.
- Display mode is URL-only (`?display=`); no persistence, no in-page toggle UI.
- Stacks grouping key: `card_id` when present, otherwise normalized name (`lowercase().trim().replace(/\s+/g, ' ')`).
- All styling uses existing Tailwind theme tokens (`bg-surface-raised`, `text-text`, `border-border-strong`, `bg-surface-card`, etc.).
- i18n: new strings go in BOTH `src/lib/i18n/en.ts` and `src/lib/i18n/pt.ts`; keep the `Translations` type in sync.
- Tests run in the `server` vitest project (node env); use relative imports (`../client/...`), matching `src/lib/__tests__/autosave.test.ts`.
- Repo commit style: `feat:`, `fix:`, `docs:`, `chore:` prefixes.

## Review Amendments (approved 2026-08-04)

Incorporates three review notes before execution:

1. **No index keys in the sortable table.** `CardTable` gains a required `rowKey: (row: T) => string` prop and keys its row `{#each}` with it. Stacks groups are keyed by the stable group key expression, not `gi`.
2. **Reactive Set mutation — verified.** Plain `Set` stored in `$state` is NOT reactive in Svelte 5.56.8: the state proxy only wraps plain objects/arrays, so `.add()`/`.delete()` on a raw `Set` never invalidates dependents. Verified against installed source and a live `svelte/reactivity` test. Use `SvelteSet` from `svelte/reactivity` (`let collapsed = new SvelteSet<string>()`) — it wraps mutating methods in signals, is reactive, and its server export aliases `globalThis.Set` (SSR-safe).
3. **`Portal.svelte` is a Clerk mounting helper, not a generic portal.** Renamed `src/lib/components/ClerkMount.svelte`; doc comments and the file-structure table describe it as single-purpose (mount a Svelte snippet into a Clerk modal element), not a reusable portal.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/client/display-mode.ts` (create) | `parseDisplayMode`, `normalizeName`, `groupByCardIdentity`, `formatCondition`, `formatPrice`, `priceToNumber` — pure, unit-testable |
| `src/lib/__tests__/display-mode.test.ts` (create) | Unit tests for the above |
| `src/lib/components/ClerkMount.svelte` (create) | Clerk-specific mount helper: renders a Svelte snippet into an element provided by Clerk (custom user-profile page). Not a generic portal — single purpose, named for its use |
| `src/lib/components/UserMenu.svelte` (create) | Custom avatar + dropdown (Profile / Inbox / Manage account / Sign out) |
| `src/lib/components/CardTable.svelte` (create) | Generic sortable table used by table view |
| `src/lib/components/HeaderNav.svelte` (modify) | Swap `<UserButton>` for `<UserMenu>`, drop `clerkAppearance` |
| `src/lib/server/services/collection.service.ts` (modify) | Enrich collection rows with `cardId` |
| `src/lib/types.ts` (modify) | Add optional `cardId` to `WishlistCard` |
| `src/lib/i18n/en.ts`, `src/lib/i18n/pt.ts` (modify) | `nav.profile`, `nav.manageAccount`, `display.*` strings |
| `src/routes/[id]/+page.svelte` (modify) | Display modes + visual-spoiler fix |
| `src/routes/collection/+page.svelte` (modify) | Display modes + `cardId` mapping |

---

## Task 1: Display-mode helpers + tests

**Files:**
- Create: `src/lib/client/display-mode.ts`
- Test: `src/lib/__tests__/display-mode.test.ts`

**Interfaces:**
- Produces:
  - `export type DisplayMode = 'visual' | 'table' | 'stacks'`
  - `export function parseDisplayMode(raw: string | null | undefined, fallback: DisplayMode): DisplayMode`
  - `export function normalizeName(name: string): string`
  - `export interface GroupableCard { cardId?: string | null; name: string }`
  - `export function groupByCardIdentity<T extends GroupableCard>(cards: T[]): T[][]`
  - `export function formatCondition(condition: string | null | undefined): string`
  - `export function formatPrice(price: string | number | null | undefined, symbol?: string): string`
  - `export function priceToNumber(price: string | number | null | undefined): number | null`

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/display-mode.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
	parseDisplayMode,
	normalizeName,
	groupByCardIdentity,
	formatCondition,
	formatPrice,
	priceToNumber
} from '../client/display-mode';

describe('parseDisplayMode', () => {
	it('returns the valid mode for recognized values', () => {
		expect(parseDisplayMode('visual', 'stacks')).toBe('visual');
		expect(parseDisplayMode('table', 'stacks')).toBe('table');
		expect(parseDisplayMode('stacks', 'stacks')).toBe('stacks');
	});

	it('falls back when null or undefined', () => {
		expect(parseDisplayMode(null, 'stacks')).toBe('stacks');
		expect(parseDisplayMode(undefined, 'visual')).toBe('visual');
	});

	it('falls back for unknown or empty values', () => {
		expect(parseDisplayMode('grid', 'stacks')).toBe('stacks');
		expect(parseDisplayMode('', 'visual')).toBe('visual');
	});
});

describe('normalizeName', () => {
	it('lowercases, trims, and collapses whitespace', () => {
		expect(normalizeName('  Lightning   BOLT ')).toBe('lightning bolt');
	});
});

describe('groupByCardIdentity', () => {
	it('groups by cardId when present', () => {
		const cards = [
			{ cardId: 'a', name: 'Lightning Bolt', qty: 4 },
			{ cardId: 'b', name: 'Counterspell', qty: 2 },
			{ cardId: 'a', name: 'Lightning Bolt', qty: 1 }
		];
		const groups = groupByCardIdentity(cards);
		expect(groups).toHaveLength(2);
		expect(groups[0]).toHaveLength(2);
		expect(groups[1]).toHaveLength(1);
	});

	it('falls back to normalized name when cardId is absent', () => {
		const cards = [
			{ cardId: null, name: 'Lightning Bolt', qty: 4 },
			{ name: 'lightning   bolt', qty: 1 }
		];
		const groups = groupByCardIdentity(cards);
		expect(groups).toHaveLength(1);
	});

	it('keeps input order within groups', () => {
		const cards = [
			{ cardId: 'a', name: 'X', qty: 1 },
			{ cardId: 'b', name: 'Y', qty: 2 },
			{ cardId: 'a', name: 'X', qty: 3 }
		];
		const groups = groupByCardIdentity(cards);
		expect(groups[0].map((c) => c.qty)).toEqual([1, 3]);
		expect(groups[1].map((c) => c.qty)).toEqual([2]);
	});
});

describe('formatCondition', () => {
	it('maps known conditions and passes through unknown ones', () => {
		expect(formatCondition('NM')).toBe('Near Mint');
		expect(formatCondition('FOO')).toBe('FOO');
		expect(formatCondition(null)).toBe('');
	});
});

describe('formatPrice', () => {
	it('formats with the given symbol', () => {
		expect(formatPrice('12.50')).toBe('$12.50');
		expect(formatPrice(3, '€')).toBe('€3');
		expect(formatPrice(null)).toBe('—');
		expect(formatPrice('')).toBe('—');
	});
});

describe('priceToNumber', () => {
	it('parses numeric strings and handles empties', () => {
		expect(priceToNumber('12.50')).toBe(12.5);
		expect(priceToNumber(null)).toBeNull();
		expect(priceToNumber('')).toBeNull();
		expect(priceToNumber('abc')).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run --project server src/lib/__tests__/display-mode.test.ts`
Expected: FAIL — module `../client/display-mode` cannot be resolved.

- [ ] **Step 3: Write the implementation**

`src/lib/client/display-mode.ts`:

```ts
export type DisplayMode = 'visual' | 'table' | 'stacks';

const VALID_MODES: readonly string[] = ['visual', 'table', 'stacks'];

export function parseDisplayMode(
	raw: string | null | undefined,
	fallback: DisplayMode
): DisplayMode {
	if (raw && VALID_MODES.includes(raw)) {
		return raw as DisplayMode;
	}
	return fallback;
}

export function normalizeName(name: string): string {
	return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

export interface GroupableCard {
	cardId?: string | null;
	name: string;
}

export function groupByCardIdentity<T extends GroupableCard>(cards: T[]): T[][] {
	const groups = new Map<string, T[]>();
	for (const card of cards) {
		const key = card.cardId ?? normalizeName(card.name);
		const list = groups.get(key);
		if (list) {
			list.push(card);
		} else {
			groups.set(key, [card]);
		}
	}
	return Array.from(groups.values());
}

const CONDITION_LABELS: Record<string, string> = {
	NM: 'Near Mint',
	LP: 'Lightly Played',
	MP: 'Moderately Played',
	HP: 'Heavily Played',
	DMG: 'Damaged'
};

export function formatCondition(condition: string | null | undefined): string {
	if (!condition) return '';
	return CONDITION_LABELS[condition] ?? condition;
}

export function formatPrice(price: string | number | null | undefined, symbol = '$'): string {
	if (price == null || price === '') return '—';
	return `${symbol}${price}`;
}

export function priceToNumber(price: string | number | null | undefined): number | null {
	if (price == null || price === '') return null;
	const n = typeof price === 'number' ? price : parseFloat(price);
	return Number.isNaN(n) ? null : n;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run --project server src/lib/__tests__/display-mode.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/client/display-mode.ts src/lib/__tests__/display-mode.test.ts
git commit -m "feat: add display-mode parsing and card grouping helpers"
```

---

## Task 2: i18n strings

**Files:**
- Modify: `src/lib/i18n/en.ts`
- Modify: `src/lib/i18n/pt.ts`

**Interfaces:**
- Produces (used by UserMenu, CardTable, and both pages):
  - `nav.profile`, `nav.manageAccount`
  - `display.columns.{name,qty,set,collectorNumber,finish,condition,language,signed,altered,tradeable,usd,eur}`
  - `display.stackCount`

- [ ] **Step 1: Add strings to `en.ts`**

In `src/lib/i18n/en.ts`, inside `nav` add two keys after `inbox`:

```ts
	nav: {
		wants: 'Wants',
		haves: 'Haves',
		trades: 'Trades',
		tools: 'Tools',
		signIn: 'Sign In',
		signOut: 'Sign Out',
		inbox: 'Inbox',
		profile: 'Profile',
		manageAccount: 'Manage account'
	},
```

Add a top-level `display` block after `profile` (before `common`):

```ts
	display: {
		stackCount: 'stacks',
		columns: {
			name: 'Name',
			qty: 'Qty',
			set: 'Set',
			collectorNumber: '#',
			finish: 'Finish',
			condition: 'Condition',
			language: 'Language',
			signed: 'Signed',
			altered: 'Altered',
			tradeable: 'Tradeable',
			usd: 'USD',
			eur: 'EUR'
		}
	},
```

- [ ] **Step 2: Add strings to `pt.ts`**

In `src/lib/i18n/pt.ts`, inside `nav` add:

```ts
	nav: {
		wants: 'Quer',
		haves: 'Tem',
		trades: 'Trocas',
		tools: 'Ferramentas',
		signIn: 'Entrar',
		signOut: 'Sair',
		inbox: 'Caixa de Entrada',
		profile: 'Perfil',
		manageAccount: 'Gerenciar conta'
	},
```

Add a top-level `display` block after `profile` (before `common`):

```ts
	display: {
		stackCount: 'pilhas',
		columns: {
			name: 'Nome',
			qty: 'Qtd',
			set: 'Coleção',
			collectorNumber: '#',
			finish: 'Acabamento',
			condition: 'Condição',
			language: 'Idioma',
			signed: 'Assinada',
			altered: 'Alterada',
			tradeable: 'Trocável',
			usd: 'USD',
			eur: 'EUR'
		}
	},
```

- [ ] **Step 3: Verify types still check**

Run: `pnpm check`
Expected: PASS — no type errors (the `Translations` type is derived from `en`, and `pt` is typed `Translations`, so both files must stay in sync).

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n/en.ts src/lib/i18n/pt.ts
git commit -m "feat: add i18n strings for user menu and display columns"
```

---

## Task 3: ClerkMount + UserMenu components, wire into HeaderNav

**Files:**
- Create: `src/lib/components/ClerkMount.svelte`
- Create: `src/lib/components/UserMenu.svelte`
- Modify: `src/lib/components/HeaderNav.svelte`

**Interfaces:**
- Consumes: `nav.profile`, `nav.manageAccount`, `nav.inbox`, `nav.signOut`, `profile.bio` i18n paths; `ProfileInfoPage.svelte` (existing); `./icons/ProfileIcon.svelte`, `./icons/InboxIcon.svelte` (existing).
- Produces: `<UserMenu />` (no props) rendered by `HeaderNav`.

- [ ] **Step 1: Create `ClerkMount.svelte`**

`ClerkMount.svelte` exists solely so `svelte`'s `mount()` can render a Svelte snippet (with its component context intact) into a DOM element Clerk hands us for a custom user-profile page. It is intentionally trivial and single-purpose — not a general portal abstraction.

`src/lib/components/ClerkMount.svelte`:

```svelte
<script lang="ts">
	let { children }: { children: import('svelte').Snippet } = $props();
</script>

{@render children()}
```

- [ ] **Step 2: Create `UserMenu.svelte`**

`src/lib/components/UserMenu.svelte`:

```svelte
<script lang="ts">
	import { mount, unmount } from 'svelte';
	import { resolve } from '$app/paths';
	import { useClerkContext } from 'svelte-clerk';
	import { getLocaleStore, t } from '$lib/i18n';
	import ClerkMount from './ClerkMount.svelte';
	import ProfileInfoPage from './ProfileInfoPage.svelte';
	import ProfileIcon from './icons/ProfileIcon.svelte';
	import InboxIcon from './icons/InboxIcon.svelte';

	let clerkCtx = useClerkContext();
	let localeStore = getLocaleStore();

	let user = $derived(clerkCtx.user);
	let isOpen = $state(false);
	let menuRef = $state<HTMLDivElement | null>(null);
	let profileApp: ReturnType<typeof mount> | null = null;

	let initials = $derived.by(() => {
		const u = user;
		if (!u) return '';
		const first = u.firstName?.[0] ?? '';
		const last = u.lastName?.[0] ?? '';
		if (first || last) return (first + last).toUpperCase();
		return (u.username?.[0] ?? u.primaryEmailAddress?.emailAddress?.[0] ?? '?').toUpperCase();
	});

	function close() {
		isOpen = false;
	}

	$effect(() => {
		if (!isOpen) return;
		function onPointerDown(event: PointerEvent) {
			if (menuRef && !menuRef.contains(event.target as Node)) {
				close();
			}
		}
		function onKeydown(event: KeyboardEvent) {
			if (event.key === 'Escape') close();
		}
		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeydown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeydown);
		};
	});

	function openAccount() {
		close();
		clerkCtx.clerk?.openUserProfile({
			customPages: [
				{
					url: 'custom',
					label: t(localeStore, 'profile.bio'),
					mount(el) {
						profileApp = mount(ClerkMount, { target: el, props: { children: profilePageSnippet } });
					},
					unmount() {
						if (profileApp) {
							unmount(profileApp);
							profileApp = null;
						}
					}
				}
			]
		});
	}

	function signOut() {
		close();
		clerkCtx.clerk?.signOut({ redirectUrl: resolve('/') });
	}
</script>

{#snippet profilePageSnippet()}
	<ProfileInfoPage />
{/snippet}

{#if user}
	<div class="relative" bind:this={menuRef}>
		<button
			type="button"
			onclick={() => (isOpen = !isOpen)}
			aria-expanded={isOpen}
			aria-haspopup="menu"
			class="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border-strong bg-surface-card text-xs font-semibold text-text transition-colors hover:border-accent/60"
		>
			{#if user.imageUrl}
				<img src={user.imageUrl} alt="" class="h-full w-full object-cover" />
			{:else}
				{initials}
			{/if}
		</button>

		{#if isOpen}
			<div
				role="menu"
				class="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-border-strong bg-surface-raised py-1 shadow-xl"
			>
				<div class="border-b border-border px-4 py-3">
					<p class="truncate text-sm font-medium text-text">
						{user.fullName || user.username || user.primaryEmailAddress?.emailAddress || 'User'}
					</p>
					{#if user.primaryEmailAddress?.emailAddress}
						<p class="truncate text-xs text-text-muted">{user.primaryEmailAddress.emailAddress}</p>
					{/if}
				</div>

				<a
					href={resolve(`/users/${user.id}`)}
					role="menuitem"
					onclick={close}
					class="flex items-center gap-3 px-4 py-2 text-sm text-text-dim transition-colors hover:bg-surface-card hover:text-text"
				>
					<ProfileIcon />
					{t(localeStore, 'nav.profile')}
				</a>

				<a
					href={resolve('/inbox')}
					role="menuitem"
					onclick={close}
					class="flex items-center gap-3 px-4 py-2 text-sm text-text-dim transition-colors hover:bg-surface-card hover:text-text"
				>
					<InboxIcon />
					{t(localeStore, 'nav.inbox')}
				</a>

				<button
					type="button"
					role="menuitem"
					onclick={openAccount}
					class="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-text-dim transition-colors hover:bg-surface-card hover:text-text"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z"
						/>
					</svg>
					{t(localeStore, 'nav.manageAccount')}
				</button>

				<button
					type="button"
					role="menuitem"
					onclick={signOut}
					class="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-danger transition-colors hover:bg-surface-card"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
						/>
					</svg>
					{t(localeStore, 'nav.signOut')}
				</button>
			</div>
		{/if}
	</div>
{/if}
```

Note: `t(localeStore, ...)` is called with the store instance — this is the same call signature used elsewhere (`HeaderNav` passes `$localeStore`; the `t` helper accepts a `Locale`). `$localeStore` auto-subscribes in runes scripts, so use `$localeStore` in the template calls below only if needed; in this component we call `t` inside handlers, so pass `$localeStore` explicitly. **Correction for the code above:** replace every `t(localeStore, ...)` with `t($localeStore, ...)`.

- [ ] **Step 3: Update `HeaderNav.svelte`**

Replace the `<script>` block's Clerk-related lines. Current imports (lines 1-11):

```ts
	import { useClerkContext, SignInButton, UserButton } from 'svelte-clerk';
	import { resolve } from '$app/paths';
	import ThemeToggle from './ThemeToggle.svelte';
	import LocaleToggle from './LocaleToggle.svelte';
	import NotificationBell from './NotificationBell.svelte';
	import { getLocaleStore, t } from '$lib/i18n';
	import ProfileInfoPage from './ProfileInfoPage.svelte';
	import InboxIcon from './icons/InboxIcon.svelte';
	import ProfileIcon from './icons/ProfileIcon.svelte';
	import { theme } from '$lib/stores/theme';
```

becomes:

```ts
	import { useClerkContext, SignInButton } from 'svelte-clerk';
	import { resolve } from '$app/paths';
	import ThemeToggle from './ThemeToggle.svelte';
	import LocaleToggle from './LocaleToggle.svelte';
	import NotificationBell from './NotificationBell.svelte';
	import { getLocaleStore, t } from '$lib/i18n';
	import UserMenu from './UserMenu.svelte';
```

Delete the `isDark` derived and the entire `clerkAppearance` derived (current lines 22-43):

```ts
	let isDark = $derived(...);
	...
	});
```

Delete these two statements from the signed-in block (current lines 131-150):

```svelte
	{#if isSignedIn}
		<NotificationBell />
		<UserButton appearance={clerkAppearance}>
			<UserButton.MenuItems>
				<UserButton.Link
					label={t($localeStore, 'nav.inbox')}
					href={resolve('/inbox')}
					labelIcon={InboxIcon}
				/>
				<UserButton.Action label="manageAccount" />
				<UserButton.Action label="signOut" />
			</UserButton.MenuItems>
			<UserButton.UserProfilePage
				label={t($localeStore, 'profile.bio')}
				url="custom"
				labelIcon={ProfileIcon}
			>
				<ProfileInfoPage />
			</UserButton.UserProfilePage>
		</UserButton>
	{:else}
```

becomes:

```svelte
	{#if isSignedIn}
		<NotificationBell />
		<UserMenu />
	{:else}
```

Keep everything else in the file unchanged (nav links, tools dropdown, admin link, mobile nav, `SignInButton`).

- [ ] **Step 4: Typecheck**

Run: `pnpm check`
Expected: PASS — no type errors. If `pnpm check` reports unused imports (e.g., `theme`, `ProfileInfoPage`, `ProfileIcon`, `InboxIcon`, `UserButton`), remove them — the Step 3 import list above already drops them.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ClerkMount.svelte src/lib/components/UserMenu.svelte src/lib/components/HeaderNav.svelte
git commit -m "feat: replace Clerk UserButton with custom theme-synced user menu"
```

---

## Task 4: Generic sortable CardTable component

**Files:**
- Create: `src/lib/components/CardTable.svelte`

**Interfaces:**
- Consumes: `display.columns.*` i18n paths.
- Produces:
  - `<CardTable rows={T[]} columns={TableColumn<T>[]} rowKey={(row: T) => string} onRowClick?={(row: T) => void} />`
  - `export interface TableColumn<T> { key: string; label: string; align?: 'left' | 'right'; sortValue?: (row: T) => string | number | null; render: (row: T) => string; }`
  - `rowKey` is **required** so the row `{#each}` never falls back to an index key (rows are re-sorted, so index keys would remount/mis-key DOM on every sort).

- [ ] **Step 1: Create the component**

`src/lib/components/CardTable.svelte`:

```svelte
<script lang="ts" generics="T">
	import { getLocaleStore, t } from '$lib/i18n';

	export interface TableColumn<T> {
		key: string;
		label: string;
		align?: 'left' | 'right';
		sortValue?: (row: T) => string | number | null;
		render: (row: T) => string;
	}

	let {
		rows,
		columns,
		rowKey,
		onRowClick
	}: {
		rows: T[];
		columns: TableColumn<T>[];
		rowKey: (row: T) => string;
		onRowClick?: (row: T) => void;
	} = $props();

	let localeStore = getLocaleStore();
	let sortKey = $state<string | null>(null);
	let sortDir = $state<1 | -1>(1);

	let sorted = $derived.by(() => {
		const col = columns.find((c) => c.key === sortKey);
		if (!col?.sortValue) return rows;
		const dir = sortDir;
		return [...rows].sort((a, b) => {
			const va = col.sortValue!(a);
			const vb = col.sortValue!(b);
			if (va == null && vb == null) return 0;
			if (va == null) return 1;
			if (vb == null) return -1;
			if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
			return String(va).localeCompare(String(vb)) * dir;
		});
	});

	function toggleSort(key: string) {
		if (sortKey === key) {
			sortDir = sortDir === 1 ? -1 : 1;
		} else {
			sortKey = key;
			sortDir = 1;
		}
	}
</script>

<div class="overflow-x-auto rounded-lg border border-border">
	<table class="w-full min-w-max border-collapse text-sm">
		<thead>
			<tr class="border-b border-border bg-surface-raised text-left">
				{#each columns as col (col.key)}
					<th
						class="px-3 py-2 font-medium text-text-dim {col.align === 'right'
							? 'text-right'
							: 'text-left'}"
					>
						{#if col.sortValue}
							<button
								type="button"
								onclick={() => toggleSort(col.key)}
								class="inline-flex items-center gap-1 text-text-dim transition-colors hover:text-text"
							>
								{t($localeStore, col.label)}
								{#if sortKey === col.key}
									<span class="text-accent">{sortDir === 1 ? '▲' : '▼'}</span>
								{/if}
							</button>
						{:else}
							{t($localeStore, col.label)}
						{/if}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each sorted as row (rowKey(row))}
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<tr
					class="border-b border-border bg-surface-raised transition-colors {onRowClick
						? 'cursor-pointer hover:bg-surface-card'
						: ''}"
					onclick={onRowClick ? () => onRowClick(row) : undefined}
				>
					{#each columns as col (col.key)}
						<td class="px-3 py-2 text-text {col.align === 'right' ? 'text-right' : 'text-left'}">
							{col.render(row)}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
```

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: PASS — generic component compiles.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/CardTable.svelte
git commit -m "feat: add generic sortable card table component"
```

---

## Task 5: Collection API cardId + WishlistCard type

**Files:**
- Modify: `src/lib/server/services/collection.service.ts`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces:
  - `CollectionCard.cardId: string` on the collection service interface.
  - `WishlistCard.cardId?: string | null` on the shared type.

- [ ] **Step 1: Add `cardId` to the `CollectionCard` interface**

In `src/lib/server/services/collection.service.ts`, the `CollectionCard` interface (lines 9-27) — add `cardId` after `cardPrintingId`:

```ts
export interface CollectionCard {
	id: string;
	cardPrintingId: string;
	cardId: string;
	cardName: string;
	...
```

- [ ] **Step 2: Enrich the select + map**

In `enrichCards`, change the join select (line 36):

```ts
		.select(
			'id, image_url, set_code, collector_number, finish, language, market_price_usd, market_price_eur, cards(id, name)'
		)
```

In the `printingMap` value type and the type cast array, add `cardId`:

```ts
		{
			cardId: string;
			imageUrl: string | null;
			cardName: string;
			setCode: string | null;
			...
		}
```

and in the loop body (lines 63-73) set it:

```ts
		printingMap.set(p.id, {
			cardId: p.cards?.id || '',
			imageUrl: p.image_url || null,
			...
		});
```

In the `info` fallback object (lines 77-86) add `cardId: '',`. In the returned mapping (lines 87-106) add `cardId: info.cardId,` after `cardPrintingId: c.card_printing_id,`.

- [ ] **Step 3: Add `cardId` to `WishlistCard`**

In `src/lib/types.ts`, inside `WishlistCard` (after `cardPrintingId?`):

```ts
	cardId?: string | null;
```

- [ ] **Step 4: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/services/collection.service.ts src/lib/types.ts
git commit -m "feat: expose card id in collection rows for identity grouping"
```

---

## Task 6: Wishlist display modes + visual-spoiler fix

**Files:**
- Modify: `src/routes/[id]/+page.svelte`

**Interfaces:**
- Consumes: `parseDisplayMode`, `normalizeName`, `groupByCardIdentity`, `formatCondition`, `formatPrice`, `priceToNumber` from `$lib/client/display-mode`; `CardTable` and `TableColumn` from `$lib/components/CardTable.svelte`; `page` store from `$app/stores`; `t`/`getLocaleStore` from `$lib/i18n`; `WishlistCard.cardId`.

- [ ] **Step 1: Update script — imports**

Add to the existing imports:

```ts
	import { SvelteSet } from 'svelte/reactivity';
	import { page } from '$app/stores';
	import { getLocaleStore, t } from '$lib/i18n';
	import CardTable from '$lib/components/CardTable.svelte';
	import {
		parseDisplayMode,
		normalizeName,
		groupByCardIdentity,
		formatCondition,
		formatPrice,
		priceToNumber
	} from '$lib/client/display-mode';
```

- [ ] **Step 2: Update script — LoadedWishlistItem + rawCards mapping**

Add `card_id: string;` to the `LoadedWishlistItem` interface (near `id`).

In the `rawCards` mapping (lines 29-45), add `localId` and `cardId`:

```ts
		(wishlist.cards as LoadedWishlistItem[]).map((c) => ({
			localId: c.id,
			cardId: c.card_id,
			name: c.card_name,
			...
```

- [ ] **Step 3: Update script — price-fetch remap preserves identity**

Replace the `cards = rawCards.map(...)` body in `onMount` (lines 97-111) so it keeps identity fields:

```ts
				cards = rawCards.map((card) => {
					const key = card.cardPrintingId || card.name.toLowerCase();
					return {
						localId: card.localId,
						cardId: card.cardId,
						name: card.name,
						qty: card.qty,
						imageUrl: imageByPrinting.get(key) || card.imageUrl,
						manaCost: card.manaCost,
						prices: pricesByPrinting.get(key) || card.prices,
						cardPrintingId: card.cardPrintingId,
						set: card.set,
						collectorNumber: card.collectorNumber,
						condition: card.condition,
						finish: card.finish,
						aftermarketSigned: card.aftermarketSigned,
						isAltered: card.isAltered,
						language: card.language
					};
				}) as WishlistCard[];
```

- [ ] **Step 4: Update script — display state + helpers**

After the `isDeleting`/`deleteError` state declarations, add:

```ts
	let localeStore = getLocaleStore();

	let display = $derived(parseDisplayMode($page.url.searchParams.get('display'), 'visual'));
	let stacksGroups = $derived(groupByCardIdentity(cards));
	let collapsed = new SvelteSet<string>();

	function toggleGroup(key: string) {
		if (collapsed.has(key)) {
			collapsed.delete(key);
		} else {
			collapsed.add(key);
		}
	}

	function groupKey(group: WishlistCard[]): string {
		return group[0].cardId ?? normalizeName(group[0].name);
	}
```

- [ ] **Step 5: Replace the card grid section**

Replace the entire `<div class="grid grid-cols-2 ...">...</div>` block (lines 231-260) with:

```svelte
		{#if display === 'table'}
			<CardTable
				rows={cards}
				rowKey={(c) => c.cardPrintingId ?? c.localId ?? c.name}
				columns={[
					{
						key: 'name',
						label: 'display.columns.name',
						sortValue: (c) => c.name,
						render: (c) => c.name
					},
					{
						key: 'qty',
						label: 'display.columns.qty',
						align: 'right',
						sortValue: (c) => c.qty,
						render: (c) => String(c.qty)
					},
					{
						key: 'set',
						label: 'display.columns.set',
						sortValue: (c) => c.set ?? '',
						render: (c) => (c.set ?? '').toUpperCase()
					},
					{
						key: 'collectorNumber',
						label: 'display.columns.collectorNumber',
						sortValue: (c) => c.collectorNumber ?? '',
						render: (c) => c.collectorNumber ?? ''
					},
					{
						key: 'finish',
						label: 'display.columns.finish',
						sortValue: (c) => c.finish ?? '',
						render: (c) => (c.finish && c.finish !== 'non-foil' ? c.finish : '')
					},
					{
						key: 'condition',
						label: 'display.columns.condition',
						sortValue: (c) => c.condition,
						render: (c) => formatCondition(c.condition)
					},
					{
						key: 'language',
						label: 'display.columns.language',
						sortValue: (c) => c.language ?? '',
						render: (c) => c.language ?? ''
					},
					{
						key: 'usd',
						label: 'display.columns.usd',
						align: 'right',
						sortValue: (c) => priceToNumber(c.prices?.usd),
						render: (c) => formatPrice(c.prices?.usd)
					},
					{
						key: 'eur',
						label: 'display.columns.eur',
						align: 'right',
						sortValue: (c) => priceToNumber(c.prices?.eur),
						render: (c) => formatPrice(c.prices?.eur, '€')
					}
				]}
			/>
		{:else if display === 'visual'}
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
				{#each cards as card (card.localId)}
					<PriceTooltip {card}>
						<div
							class="relative aspect-[5/7] w-full overflow-hidden rounded-lg border border-border bg-surface-raised transition-colors hover:border-border-strong"
						>
							{#if card.imageUrl}
								<img
									src={card.imageUrl}
									alt={card.name}
									loading="lazy"
									class="absolute inset-0 h-full w-full object-cover transition-transform duration-200 hover:scale-105"
								/>
							{:else}
								<div class="flex h-full w-full items-center justify-center bg-surface-card">
									<span class="px-2 text-center text-xs text-text-muted">{card.name}</span>
								</div>
							{/if}
							<div
								class="absolute top-2 right-2 rounded bg-surface/90 px-2 py-0.5 text-xs font-bold text-text"
							>
								×{card.qty}
							</div>
						</div>
						<div class="border-t border-border p-2">
							<p class="truncate text-xs text-text-soft">{card.name}</p>
						</div>
					</PriceTooltip>
				{/each}
			</div>
		{:else}
			<div class="space-y-2">
				{#each stacksGroups as group (group[0].cardId ?? normalizeName(group[0].name))}
					{@const identity = group[0]}
					{@const totalQty = group.reduce((sum, c) => sum + c.qty, 0)}
					{@const key = groupKey(group)}
					<div class="overflow-hidden rounded-lg border border-border bg-surface-raised">
						<button
							type="button"
							onclick={() => toggleGroup(key)}
							class="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-surface-card"
						>
							{#if identity.imageUrl}
								<img
									src={identity.imageUrl}
									alt=""
									class="h-12 w-8 rounded object-cover"
									loading="lazy"
								/>
							{:else}
								<div
									class="flex h-12 w-8 items-center justify-center rounded bg-surface-card text-[8px] text-text-muted"
								>
									?
								</div>
							{/if}
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-text-soft">{identity.name}</p>
								<p class="text-xs text-text-muted">
									{group.length} {t($localeStore, 'wants.cards')} · ×{totalQty}
								</p>
							</div>
							<span class="text-text-muted">{collapsed.has(key) ? '+' : '−'}</span>
						</button>
						{#if !collapsed.has(key)}
							<div class="divide-y divide-border border-t border-border">
								{#each group as card (card.localId)}
									<div
										class="flex items-center justify-between gap-3 px-4 py-2 text-xs text-text-dim"
									>
										<span class="min-w-0 truncate">
											{[card.set?.toUpperCase(), card.collectorNumber, card.finish, formatCondition(card.condition), card.language]
												.filter(Boolean)
												.join(' · ')}
										</span>
										<span class="font-medium text-text">×{card.qty}</span>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
```

- [ ] **Step 6: Typecheck**

Run: `pnpm check`
Expected: PASS. If the `CardTable` generic fails to infer `T` from the `columns` literal, add an explicit annotation before the `{/if}` block:

```ts
		{@const tableColumns: import('$lib/components/CardTable.svelte').TableColumn<WishlistCard>[] = [ ... ]}
```

and pass `columns={tableColumns}`.

- [ ] **Step 7: Commit**

```bash
git add src/routes/[id]/+page.svelte
git commit -m "feat: add visual/table/stacks display modes to wishlist; fix spoiler grid overlap"
```

---

## Task 7: Collection display modes

**Files:**
- Modify: `src/routes/collection/+page.svelte`

**Interfaces:**
- Consumes: `parseDisplayMode`, `normalizeName`, `groupByCardIdentity`, `formatCondition`, `formatPrice`, `priceToNumber` from `$lib/client/display-mode`; `CardTable` from `$lib/components/CardTable.svelte`; `page` store from `$app/stores`; `t`/`getLocaleStore` from `$lib/i18n`; `display.stackCount` i18n path; `CollectionCard.cardId` from the API.

- [ ] **Step 1: Update script — imports**

Add to the existing imports (the file already has `import { SvelteMap } from 'svelte/reactivity';` — extend it):

```ts
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { page } from '$app/stores';
	import { getLocaleStore, t } from '$lib/i18n';
	import CardTable from '$lib/components/CardTable.svelte';
	import {
		parseDisplayMode,
		normalizeName,
		groupByCardIdentity,
		formatCondition,
		formatPrice,
		priceToNumber
	} from '$lib/client/display-mode';
```

- [ ] **Step 2: Update script — display state + helpers**

After the `currentUserId`/`isSignedIn` deriveds, add:

```ts
	let localeStore = getLocaleStore();

	let display = $derived(parseDisplayMode($page.url.searchParams.get('display'), 'stacks'));
	let stacksGroups = $derived(groupByCardIdentity(collectionCards));
	let collapsed = new SvelteSet<string>();

	function toggleGroup(key: string) {
		if (collapsed.has(key)) {
			collapsed.delete(key);
		} else {
			collapsed.add(key);
		}
	}

	function groupKey(group: WishlistCard[]): string {
		return group[0].cardId ?? normalizeName(group[0].name);
	}
```

- [ ] **Step 3: Update `loadCollection` mapping — carry `cardId`**

In `loadCollection`, add `cardId: string;` to the inline `c` type and add `cardId: c.cardId,` to the mapped object (after `cardPrintingId: c.cardPrintingId,`).

- [ ] **Step 4: Replace the collection list section**

Replace the `{:else if collectionCards.length > 0}` branch (lines 513-518) — the `<div class="max-h-[400px] space-y-2 overflow-y-auto pr-2">…CardRow…</div>` — with:

```svelt
				{:else if collectionCards.length > 0}
					{#if display === 'table'}
						<div class="max-h-[400px] overflow-y-auto pr-2">
							<CardTable
								rows={collectionCards}
								rowKey={(c) => c.cardPrintingId ?? c.localId ?? c.name}
								onRowClick={(card) => openCardEdit(card)}
								columns={[
									{ key: 'name', label: 'display.columns.name', sortValue: (c) => c.name, render: (c) => c.name },
									{ key: 'qty', label: 'display.columns.qty', align: 'right', sortValue: (c) => c.qty, render: (c) => String(c.qty) },
									{ key: 'set', label: 'display.columns.set', sortValue: (c) => c.set ?? '', render: (c) => (c.set ?? '').toUpperCase() },
									{ key: 'collectorNumber', label: 'display.columns.collectorNumber', sortValue: (c) => c.collectorNumber ?? '', render: (c) => c.collectorNumber ?? '' },
									{ key: 'finish', label: 'display.columns.finish', sortValue: (c) => c.finish ?? '', render: (c) => (c.finish && c.finish !== 'non-foil' ? c.finish : '') },
									{ key: 'condition', label: 'display.columns.condition', sortValue: (c) => c.condition, render: (c) => formatCondition(c.condition) },
									{ key: 'language', label: 'display.columns.language', sortValue: (c) => c.language ?? '', render: (c) => c.language ?? '' },
									{ key: 'signed', label: 'display.columns.signed', sortValue: (c) => (c.aftermarketSigned ? 1 : 0), render: (c) => (c.aftermarketSigned ? '✓' : '—') },
									{ key: 'altered', label: 'display.columns.altered', sortValue: (c) => (c.isAltered ? 1 : 0), render: (c) => (c.isAltered ? '✓' : '—') },
									{ key: 'tradeable', label: 'display.columns.tradeable', sortValue: (c) => (c.isTradeable ? 1 : 0), render: (c) => (c.isTradeable ? '✓' : '—') },
									{ key: 'usd', label: 'display.columns.usd', align: 'right', sortValue: (c) => priceToNumber(c.prices?.usd), render: (c) => formatPrice(c.prices?.usd) },
									{ key: 'eur', label: 'display.columns.eur', align: 'right', sortValue: (c) => priceToNumber(c.prices?.eur), render: (c) => formatPrice(c.prices?.eur, '€') }
								]}
							/>
						</div>
					{:else if display === 'visual'}
						<div class="max-h-[400px] overflow-y-auto pr-2">
							<div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
								{#each collectionCards as card (card.localId)}
									<button
										type="button"
										onclick={() => openCardEdit(card)}
										class="block w-full text-left"
									>
										<div
											class="relative aspect-[5/7] w-full overflow-hidden rounded-lg border border-border bg-surface-raised transition-colors hover:border-border-strong"
										>
											{#if card.imageUrl}
												<img
													src={card.imageUrl}
													alt={card.name}
													loading="lazy"
													class="absolute inset-0 h-full w-full object-cover transition-transform duration-200 hover:scale-105"
												/>
											{:else}
												<div
													class="flex h-full w-full items-center justify-center bg-surface-card"
												>
													<span class="px-2 text-center text-xs text-text-muted">{card.name}</span>
												</div>
											{/if}
											<div
												class="absolute top-2 right-2 rounded bg-surface/90 px-2 py-0.5 text-xs font-bold text-text"
											>
												×{card.qty}
											</div>
										</div>
										<div class="border-t border-border p-2">
											<p class="truncate text-xs text-text-soft">{card.name}</p>
										</div>
									</button>
								{/each}
							</div>
						</div>
					{:else}
						<div class="max-h-[400px] space-y-2 overflow-y-auto pr-2">
							{#each stacksGroups as group (group[0].cardId ?? normalizeName(group[0].name))}
								{@const identity = group[0]}
								{@const totalQty = group.reduce((sum, c) => sum + c.qty, 0)}
								{@const key = groupKey(group)}
								<div class="overflow-hidden rounded-lg border border-border bg-surface-raised">
									<button
										type="button"
										onclick={() => toggleGroup(key)}
										class="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-surface-card"
									>
										{#if identity.imageUrl}
											<img
												src={identity.imageUrl}
												alt=""
												class="h-12 w-8 rounded object-cover"
												loading="lazy"
											/>
										{:else}
											<div
												class="flex h-12 w-8 items-center justify-center rounded bg-surface-card text-[8px] text-text-muted"
											>
												?
											</div>
										{/if}
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium text-text-soft">{identity.name}</p>
											<p class="text-xs text-text-muted">
												{group.length} {t($localeStore, 'display.stackCount')} · ×{totalQty}
											</p>
										</div>
										<span class="text-text-muted">{collapsed.has(key) ? '+' : '−'}</span>
									</button>
									{#if !collapsed.has(key)}
										<div class="divide-y divide-border border-t border-border">
											{#each group as card (card.localId)}
												<button
													type="button"
													onclick={() => openCardEdit(card)}
													class="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-xs text-text-dim transition-colors hover:bg-surface-card"
												>
													<span class="min-w-0 truncate">
														{[formatCondition(card.condition), card.finish && card.finish !== 'non-foil' ? card.finish : '', card.set?.toUpperCase(), card.collectorNumber, card.language, card.aftermarketSigned ? 'Signed' : '', card.isAltered ? 'Altered' : '']
															.filter(Boolean)
															.join(' · ')}
													</span>
													<span class="font-medium text-text">×{card.qty}</span>
												</button>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				{:else}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/collection/+page.svelte
git commit -m "feat: add visual/table/stacks display modes to collection"
```

---

## Task 8: Final verification

**Files:** none.

- [ ] **Step 1: Run the full unit test suite**

Run: `pnpm exec vitest run --project server`
Expected: PASS — all existing server tests plus `display-mode.test.ts`.

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: PASS (Prettier check + ESLint). If Prettier reports formatting drift, run `pnpm format` and re-run `pnpm lint`.

- [ ] **Step 4: Manual smoke check (optional, needs dev environment)**

Run: `pnpm dev`
Verify:
- Signed in: header shows the custom avatar; dropdown lists Profile / Inbox / Manage account / Sign out with no Clerk branding; dropdown follows the theme toggle immediately.
- `/collection?display=table`, `?display=visual`, `?display=stacks` render the three modes; sorting works; visual grid cells are equal size and nothing overlaps on hover.
- `/<wishlistId>?display=visual|table|stacks` same for wishlists; duplicate-name cards render separately (no overlap).
