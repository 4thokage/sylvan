<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import type { WishlistCard } from '$lib/scryfall/api';

	let { data } = $props() as { data: { wishlist: { id: string; cards: WishlistCard[] } } };
	const wishlist = $derived(data.wishlist);
	const cards = $derived(wishlist.cards);

	const proxyCards = $derived(
		cards.flatMap((card) =>
			Array.from({ length: card.qty }, () => ({
				name: card.name,
				imageUrl: card.imageUrl
			}))
		)
	);

	const pages = $derived(
		proxyCards.reduce<Array<{ name: string; imageUrl: string | null; index: number }[]>>(
			(acc, card, i) => {
				if (i % 9 === 0) acc.push([]);
				acc[acc.length - 1].push({ ...card, index: i });
				return acc;
			},
			[]
		)
	);

	function handlePrint() {
		window.print();
	}
</script>

<svelte:head>
	<title>Sylvan Web - Print Proxies</title>
</svelte:head>

<div class="no-print fixed top-4 right-4 z-50 flex gap-3">
	<a
		href="/{wishlist.id}"
		class="rounded-lg bg-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-600"
		data-sveltekit-preload-data
	>
		← Back to Wishlist
	</a>
	<button
		onclick={handlePrint}
		class="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white transition-colors hover:bg-emerald-500"
	>
		Print Proxies
	</button>
</div>

<div class="min-h-screen bg-white p-1">
	{#each pages as page, pageIndex (pageIndex)}
		<div class="print-grid grid grid-cols-3 gap-0">
			{#each page as card, cardIndex (cardIndex)}
				<div class="relative aspect-[5/7] overflow-hidden">
					{#if card.imageUrl}
						<img src={card.imageUrl} alt={card.name} class="h-full w-full object-contain" />
					{:else}
						<div class="flex h-full items-center justify-center bg-zinc-200">
							<span class="text-sm text-zinc-500">{card.name}</span>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/each}
</div>

<p class="no-print p-4 text-center text-sm text-zinc-500">
	{proxyCards.length} cards · Designed for US Letter paper · 9 cards per page
</p>

<style>
	@media print {
		@page {
			size: A4;
			margin: 0;
		}

		.no-print {
			display: none !important;
		}

		.print-grid {
			page-break-after: always;
		}

		.print-grid:last-child {
			page-break-after: auto;
		}
	}
</style>
