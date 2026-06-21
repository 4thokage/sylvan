<script lang="ts">
	import { getCreatorFingerprint } from '$lib/device';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { WishlistCard, LookupResult } from '$lib/types';
	import PriceTooltip from '$lib/components/PriceTooltip.svelte';

	let { data } = $props();
	const wishlist = $derived(data.wishlist);
	const gameSlug = $derived(wishlist.game_slug || 'mtg');
	const rawCards = $derived(
		(wishlist.cards as Array<{ card_name: string; quantity: number }>).map((c) => ({
			name: c.card_name,
			qty: c.quantity,
			imageUrl: null as string | null
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

	onMount(async () => {
		cards = rawCards as WishlistCard[];

		try {
			const response = await fetch('/api/prices', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cards: rawCards.map((c) => ({ name: c.name })),
					gameSlug
				})
			});

			const result = await response.json();

			if (result.success && result.data?.prices) {
				const pricesMap = new Map<string, {
					usd: string | null;
					usdFoil: string | null;
					eur: string | null;
					eurFoil: string | null;
					tix: string | null;
					oracleId: string | null;
					set: string | null;
					setName: string | null;
				}>();
				const imageMap = new Map<string, string | null>();

				for (const p of result.data.prices) {
					if (p.prices) {
						pricesMap.set(p.name.toLowerCase(), p.prices);
					}
					if (p.imageUrl) {
						imageMap.set(p.name.toLowerCase(), p.imageUrl);
					}
				}

				cards = rawCards.map((card) => ({
					name: card.name,
					qty: card.qty,
					imageUrl: imageMap.get(card.name.toLowerCase()) || null,
					manaCost: null,
					prices: pricesMap.get(card.name.toLowerCase()) || undefined
				})) as WishlistCard[];
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
				goto('/');
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
		content={cards.slice(0, 5).map((c) => `${c.qty}x ${c.name}`).join(', ')}
	/>
	<meta property="og:type" content="website" />
	<meta property="og:title" content="Wishlist - {cards.length} cards" />
	<meta
		property="og:description"
		content={cards.slice(0, 5).map((c) => `${c.qty}x ${c.name}`).join(', ')}
	/>
	{#if cards[0]?.imageUrl}
		<meta property="og:image" content={cards[0].imageUrl} />
	{/if}
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Wishlist - {cards.length} cards" />
	<meta
		name="twitter:description"
		content={cards.slice(0, 5).map((c) => `${c.qty}x ${c.name}`).join(', ')}
	/>
	{#if cards[0]?.imageUrl}
		<meta name="twitter:image" content={cards[0].imageUrl} />
	{/if}
</svelte:head>

<div class="min-h-screen bg-surface text-text">
	<header class="border-b border-border px-6 py-4">
		<div class="mx-auto flex max-w-7xl items-center justify-between">
			<div>
				<p class="mt-1 text-sm text-text-muted">{ownerName ? `${ownerName}'s Wishlist` : 'Shared Wishlist'}</p>
			</div>
			<div class="flex items-center gap-4">
				<a href="/{wishlist.id}/print" class="text-sm text-text-dim transition-colors hover:text-text">
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
				<a href="/" class="text-sm text-text-dim transition-colors hover:text-text" data-sveltekit-preload-data>
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

		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
			{#each cards as card (card.name)}
				<PriceTooltip {card}>
					<div class="group relative cursor-pointer overflow-hidden rounded-lg border border-border bg-surface-raised transition-all hover:scale-[1.02] hover:border-border-strong">
						{#if card.imageUrl}
							<img src={card.imageUrl} alt={card.name} class="aspect-[5/7] w-full object-cover" loading="lazy" />
						{:else}
							<div class="flex aspect-[5/7] w-full items-center justify-center bg-surface-card">
								<span class="px-2 text-center text-xs text-text-muted">{card.name}</span>
							</div>
						{/if}
						<div class="absolute top-2 right-2 rounded bg-surface/90 px-2 py-0.5 text-xs font-bold text-text">
							×{card.qty}
						</div>
						<div class="border-t border-border p-2">
							<p class="truncate text-xs text-text-soft">{card.name}</p>
						</div>
					</div>
				</PriceTooltip>
			{/each}
		</div>
	</main>
</div>
