<script lang="ts">
	import { getCreatorFingerprint } from '$lib/device';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import type { WishlistCard, CardPrices } from '$lib/types';
	import PriceTooltip from '$lib/components/PriceTooltip.svelte';
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

	interface LoadedWishlistItem {
		id: string;
		card_id: string;
		card_name: string;
		image_url: string | null;
		quantity: number;
		condition: 'NM' | 'LP' | 'MP' | 'HP' | 'DMG' | null;
		finish: string | null;
		aftermarket_signed: boolean | null;
		is_altered: boolean | null;
		language: string | null;
		card_printing_id: string | null;
		set_code: string | null;
		collector_number: string | null;
		prices: CardPrices | null;
	}

	let { data } = $props();
	const wishlist = $derived(data.wishlist);
	const gameSlug = $derived(wishlist.game_slug || 'mtg');
	const rawCards = $derived(
		(wishlist.cards as LoadedWishlistItem[]).map((c) => ({
			localId: c.id,
			cardId: c.card_id,
			name: c.card_name,
			qty: c.quantity,
			imageUrl: c.image_url,
			manaCost: null as string | null,
			condition: c.condition || ('NM' as const),
			finish: c.finish,
			aftermarketSigned: c.aftermarket_signed || false,
			isAltered: c.is_altered || false,
			language: c.language,
			cardPrintingId: c.card_printing_id,
			set: c.set_code || undefined,
			collectorNumber: c.collector_number || undefined,
			prices: c.prices || undefined
		}))
	);

	let cards = $state<WishlistCard[]>([]);
	let pricesLoading = $state(true);
	let pricesError = $state<string | null>(null);

	const totalCards = $derived(cards.reduce((sum, c) => sum + c.qty, 0));
	const totalEurValue = $derived(
		cards.reduce((sum, card) => {
			const price = parseFloat(card.prices?.eur || '0');
			return sum + price * card.qty;
		}, 0)
	);
	const ownerName = $derived(wishlist.owner_name as string | null);
	const creatorFingerprint = $derived(wishlist.creator_fingerprint as string | null);
	const canDelete = $derived(creatorFingerprint === getCreatorFingerprint());
	let isDeleting = $state(false);
	let deleteError = $state<string | null>(null);

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

	onMount(async () => {
		cards = rawCards as WishlistCard[];

		try {
			const response = await fetch('/api/prices', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cards: rawCards.map((c) => ({
						name: c.name,
						cardPrintingId: c.cardPrintingId,
						finish: c.finish
					})),
					gameSlug
				})
			});

			const result = await response.json();

			if (result.success && result.data?.prices) {
				const pricesByPrinting = new SvelteMap<string, CardPrices>();
				const imageByPrinting = new SvelteMap<string, string | null>();

				for (const p of result.data.prices) {
					const key = p.cardPrintingId || p.name.toLowerCase();
					if (p.prices) {
						pricesByPrinting.set(key, p.prices);
					}
					if (p.imageUrl) {
						imageByPrinting.set(key, p.imageUrl);
					}
				}

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
			} else {
				pricesError = result.error?.message || 'Failed to fetch prices';
			}
		} catch {
			pricesError = 'Failed to fetch prices';
		} finally {
			pricesLoading = false;
		}
	});

	async function deleteWishlist() {
		if (!canDelete || isDeleting) return;
		isDeleting = true;
		deleteError = null;

		try {
			const response = await fetch(
				`/api/delete?id=${wishlist.id}&fingerprint=${getCreatorFingerprint()}`,
				{ method: 'DELETE' }
			);
			const result = await response.json();
			if (result.success) {
				goto(resolve('/'));
			} else {
				deleteError = result.error?.message ?? 'Failed to delete wishlist';
			}
		} catch {
			deleteError = 'Failed to delete wishlist';
		} finally {
			isDeleting = false;
		}
	}
</script>

<svelte:head>
	<title>Sylvan - Wishlist ({cards.length} cards)</title>
	<meta
		name="description"
		content={cards
			.slice(0, 5)
			.map((c) => `${c.qty}x ${c.name}`)
			.join(', ')}
	/>
	<meta property="og:type" content="website" />
	<meta property="og:title" content="Wishlist - {cards.length} cards" />
	<meta
		property="og:description"
		content={cards
			.slice(0, 5)
			.map((c) => `${c.qty}x ${c.name}`)
			.join(', ')}
	/>
	{#if cards[0]?.imageUrl}
		<meta property="og:image" content={cards[0].imageUrl} />
	{/if}
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Wishlist - {cards.length} cards" />
	<meta
		name="twitter:description"
		content={cards
			.slice(0, 5)
			.map((c) => `${c.qty}x ${c.name}`)
			.join(', ')}
	/>
	{#if cards[0]?.imageUrl}
		<meta name="twitter:image" content={cards[0].imageUrl} />
	{/if}
</svelte:head>

<div class="min-h-screen bg-surface text-text">
	<header class="border-b border-border px-6 py-4">
		<div class="mx-auto flex max-w-7xl items-center justify-between">
			<div>
				<p class="mt-1 text-sm text-text-muted">
					{ownerName ? `${ownerName}'s Wishlist` : 'Shared Wishlist'}
				</p>
			</div>
			<div class="flex items-center gap-4">
				<a
					href={resolve(`/${wishlist.id}/print`)}
					class="text-sm text-text-dim transition-colors hover:text-text"
				>
					Print Proxies
				</a>
				{#if canDelete}
					<button
						onclick={deleteWishlist}
						disabled={isDeleting}
						class="text-sm text-danger transition-colors hover:text-red-300 disabled:opacity-50"
					>
						{isDeleting ? 'Deleting...' : 'Delete'}
					</button>
				{/if}
				<a
					href={resolve('/')}
					class="text-sm text-text-dim transition-colors hover:text-text"
					data-sveltekit-preload-data
				>
					Create New →
				</a>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-7xl p-6">
		{#if deleteError}
			<div class="mb-4 rounded-lg bg-danger-bg p-3 text-sm text-danger">{deleteError}</div>
		{/if}
		<div class="mb-6 flex items-center justify-between">
			<p class="text-text-muted">
				{cards.length} unique cards · {totalCards} total · €{totalEurValue.toFixed(2)}
			</p>
			{#if pricesLoading}
				<span class="text-xs text-text-muted">Loading prices...</span>
			{:else if pricesError}
				<span class="text-xs text-danger">{pricesError}</span>
			{/if}
		</div>

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
									{group.length}
									{t($localeStore, 'wants.cards')} · ×{totalQty}
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
											{[
												card.set?.toUpperCase(),
												card.collectorNumber,
												card.finish,
												formatCondition(card.condition),
												card.language
											]
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
	</main>
</div>
