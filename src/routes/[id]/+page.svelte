<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { getCreatorFingerprint } from '$lib/device';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import type { WishlistCard } from '$lib/scryfall/api';
	import PriceTooltip from '$lib/components/PriceTooltip.svelte';

	interface CardPrices {
		usd: string | null;
		usdFoil: string | null;
		eur: string | null;
		eurFoil: string | null;
		tix: string | null;
		oracleId: string | null;
		set: string | null;
		setName: string | null;
	}

	let { data } = $props();
	const wishlist = $derived(data.wishlist);
	const rawCards = $derived(wishlist.cards as WishlistCard[]);

	let cards = $state<WishlistCard[]>([]);
	let pricesLoading = $state(true);
	let pricesError = $state<string | null>(null);

	const totalCards = $derived(cards.reduce((sum, c) => sum + c.qty, 0));
	const creatorFingerprint = $derived(wishlist.creator_fingerprint as string | null);
	const canDelete = $derived(creatorFingerprint === getCreatorFingerprint());
	let isDeleting = $state(false);
	let deleteError = $state<string | null>(null);

	onMount(async () => {
		cards = rawCards;

		try {
			const response = await fetch('/api/prices', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ cards: rawCards.map((c) => ({ name: c.name })) })
			});

			const result = await response.json();

			if (result.success && result.data?.prices) {
				const pricesMap = new SvelteMap<string, CardPrices>();
				for (const p of result.data.prices) {
					if (p.prices) {
						pricesMap.set(p.name.toLowerCase(), p.prices);
					}
				}

				cards = rawCards.map((card) => ({
					...card,
					prices: pricesMap.get(card.name.toLowerCase()) || undefined
				}));
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
				{
					method: 'DELETE'
				}
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
	<title>Sylvan Web - MTG Wishlist ({cards.length} cards)</title>
	<meta
		name="description"
		content={cards
			.slice(0, 5)
			.map((c) => `${c.qty}x ${c.name}`)
			.join(', ')}
	/>

	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="website" />
	<meta property="og:title" content="MTG Wishlist - {cards.length} cards" />
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

	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="MTG Wishlist - {cards.length} cards" />
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

<div class="min-h-screen bg-zinc-950 text-zinc-100">
	<header class="border-b border-zinc-800 px-6 py-4">
		<div class="mx-auto flex max-w-7xl items-center justify-between">
			<div>
				<h1 class="text-2xl font-semibold tracking-tight text-emerald-400">Sylvan Web</h1>
				<p class="mt-1 text-sm text-zinc-500">Shared Wishlist</p>
			</div>
			<div class="flex items-center gap-4">
				<a
					href="/{wishlist.id}/print"
					class="text-sm text-zinc-400 transition-colors hover:text-zinc-200"
				>
					Print Proxies
				</a>
				{#if canDelete}
					<button
						onclick={deleteWishlist}
						disabled={isDeleting}
						class="text-sm text-red-400 transition-colors hover:text-red-300 disabled:opacity-50"
					>
						{isDeleting ? 'Deleting...' : 'Delete'}
					</button>
				{/if}
				<a
					href="/"
					class="text-sm text-zinc-400 transition-colors hover:text-zinc-200"
					data-sveltekit-preload-data
				>
					Create New →
				</a>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-7xl p-6">
		{#if deleteError}
			<div class="mb-4 rounded-lg bg-red-900/20 p-3 text-sm text-red-400">
				{deleteError}
			</div>
		{/if}
		<div class="mb-6 flex items-center justify-between">
			<p class="text-zinc-500">{cards.length} unique cards · {totalCards} total</p>
			{#if pricesLoading}
				<span class="text-xs text-zinc-500">Loading prices...</span>
			{:else if pricesError}
				<span class="text-xs text-red-400">{pricesError}</span>
			{/if}
		</div>

		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
			{#each cards as card (card.name)}
				<PriceTooltip {card}>
					<div
						class="group relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 transition-all hover:scale-[1.02] hover:border-zinc-700"
					>
						{#if card.imageUrl}
							<img
								src={card.imageUrl}
								alt={card.name}
								class="aspect-[5/7] w-full object-cover"
								loading="lazy"
							/>
						{:else}
							<div class="flex aspect-[5/7] w-full items-center justify-center bg-zinc-800">
								<span class="px-2 text-center text-xs text-zinc-600">{card.name}</span>
							</div>
						{/if}
						<div
							class="absolute top-2 right-2 rounded bg-zinc-950/90 px-2 py-0.5 text-xs font-bold text-zinc-100"
						>
							×{card.qty}
						</div>
						<div class="border-t border-zinc-800 p-2">
							<p class="truncate text-xs text-zinc-300">{card.name}</p>
							{#if card.manaCost}
								<p class="mt-0.5 text-xs text-zinc-500">{card.manaCost}</p>
							{/if}
						</div>
					</div>
				</PriceTooltip>
			{/each}
		</div>
	</main>
</div>
