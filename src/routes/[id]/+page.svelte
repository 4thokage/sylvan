<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { getCreatorFingerprint } from '$lib/device';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import type { WishlistCard, CardPrint } from '$lib/scryfall/api';
	import PriceTooltip from '$lib/components/PriceTooltip.svelte';
	import PrintingsDropdown from '$lib/components/PrintingsDropdown.svelte';

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
	let openPrintingsForCard = $state<string | null>(null);

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
		cards = rawCards;

		try {
			const response = await fetch('/api/prices', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cards: rawCards.map((c) => ({
						name: c.name,
						selectedPrintIndex: c.selectedPrintIndex
					}))
				})
			});

			const result = await response.json();

			if (result.success && result.data?.prices) {
				const pricesMap = new SvelteMap<string, CardPrices>();
				const imageMap = new SvelteMap<string, string | null>();
				const manaCostMap = new SvelteMap<string, string | null>();

				for (const p of result.data.prices) {
					if (p.isSelected && p.selectedPrintIndex !== undefined) {
						if (p.prices) {
							pricesMap.set(p.name.toLowerCase(), p.prices);
						}
						if (p.imageUrl) {
							imageMap.set(p.name.toLowerCase(), p.imageUrl);
						}
						if (p.manaCost) {
							manaCostMap.set(p.name.toLowerCase(), p.manaCost);
						}
					} else if (p.prices && !p.isSelected) {
						pricesMap.set(p.name.toLowerCase(), p.prices);
					}
				}

				cards = rawCards.map((card) => ({
					...card,
					...(imageMap.get(card.name.toLowerCase()) && {
						imageUrl: imageMap.get(card.name.toLowerCase())
					}),
					...(manaCostMap.get(card.name.toLowerCase()) && {
						manaCost: manaCostMap.get(card.name.toLowerCase())
					}),
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

	function handlePrintSelect(cardName: string, print: CardPrint, index: number) {
		cards = cards.map((card) => {
			if (card.name === cardName) {
				return {
					...card,
					imageUrl: print.imageUrl,
					manaCost: print.manaCost,
					prices: {
						usd: print.price,
						usdFoil: print.priceFoil,
						eur: null,
						eurFoil: null,
						tix: null
					},
					selectedPrintIndex: index
				};
			}
			return card;
		});
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
				{#if ownerName}
					<p class="mt-1 text-sm text-zinc-500">{ownerName}'s Wishlist</p>
				{:else}
					<p class="mt-1 text-sm text-zinc-500">Shared Wishlist</p>
				{/if}
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
			<p class="text-zinc-500">
				{cards.length} unique cards · {totalCards} total · €{totalEurValue.toFixed(2)}
			</p>
			{#if pricesLoading}
				<span class="text-xs text-zinc-500">Loading prices...</span>
			{:else if pricesError}
				<span class="text-xs text-red-400">{pricesError}</span>
			{/if}
		</div>

		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
			{#each cards as card (card.name)}
				{@const cardId = `card-${card.name.replace(/[^a-zA-Z0-9]/g, '-')}`}
				<PriceTooltip {card}>
					<div
						class="group relative cursor-pointer overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 transition-all hover:scale-[1.02] hover:border-zinc-700"
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
						{#if card.selectedPrintIndex !== undefined}
							<div
								class="absolute bottom-14 left-2 rounded bg-emerald-900/80 px-2 py-0.5 text-[10px] text-emerald-300"
							>
								{(card.printings?.[card.selectedPrintIndex]?.set ?? '').toUpperCase()}
							</div>
						{/if}
						<div class="border-t border-zinc-800 p-2">
							<div class="flex items-center justify-between">
								<p class="truncate text-xs text-zinc-300">{card.name}</p>
								<button
									type="button"
									class="edit-btn text-zinc-500 hover:text-zinc-300"
									data-card-id={cardId}
									aria-label="Edit printing"
									onclick={() =>
										(openPrintingsForCard = openPrintingsForCard === card.name ? null : card.name)}
								>
									<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
										/>
									</svg>
								</button>
							</div>
							{#if card.manaCost}
								<p class="mt-0.5 text-xs text-zinc-500">{card.manaCost}</p>
							{/if}
						</div>
					</div>
				</PriceTooltip>
			{/each}
		</div>
		{#each cards as card (card.name)}
			{@const cardId = `card-${card.name.replace(/[^a-zA-Z0-9]/g, '-')}`}
			{@const positionRef =
				typeof document !== 'undefined'
					? document.querySelector(`[data-card-id="${cardId}"]`)
					: null}
			{#if openPrintingsForCard === card.name}
				<PrintingsDropdown
					{card}
					positionRef={positionRef as HTMLElement}
					onSelect={(print, index) => {
						handlePrintSelect(card.name, print, index);
						openPrintingsForCard = null;
					}}
					isOpen={true}
				/>
			{/if}
		{/each}
	</main>
</div>
