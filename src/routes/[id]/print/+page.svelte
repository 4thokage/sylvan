<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
	const wishlist = $derived(data.wishlist);
	const rawCards = $derived(
		(wishlist.cards as Array<{ card_name: string; quantity: number }> | undefined) || []
	);

	const proxyCards = $derived(
		rawCards.flatMap((card) =>
			Array.from({ length: card.quantity }, (_, i) => ({
				name: card.card_name,
				imageUrl: null as string | null,
				index: i
			}))
		)
	);

	const pages = $derived(
		proxyCards.reduce<Array<{ name: string; imageUrl: string | null; index: number }[]>>(
			(acc, card, i) => {
				if (i % 9 === 0) acc.push([]);
				acc[acc.length - 1].push(card);
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
	<title>Sylvan - Print Proxies</title>
</svelte:head>

<div class="no-print fixed top-4 right-4 z-50 flex gap-3">
	<a
		href={resolve(`/${wishlist.id}`)}
		class="rounded-lg bg-surface-hover px-4 py-2 text-sm text-text transition-colors hover:bg-surface-hover"
		data-sveltekit-preload-data
	>
		← Back to Wishlist
	</a>
	<button
		onclick={handlePrint}
		class="rounded-lg bg-accent-bg px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover"
	>
		Print Proxies
	</button>
</div>

<div class="min-h-screen bg-white p-1">
	{#each pages as page, pageIndex (pageIndex)}
		<div class="print-grid grid grid-cols-3 gap-0">
			{#each page as card, cardIndex (cardIndex)}
				<div class="relative aspect-[5/7] overflow-hidden">
					<div class="flex h-full items-center justify-center bg-surface-card">
						<span class="text-sm text-text-muted">{card.name}</span>
					</div>
				</div>
			{/each}
		</div>
	{/each}
</div>

<p class="no-print p-4 text-center text-sm text-text-muted">
	{proxyCards.length} cards · Designed for A4 paper · 9 cards per page
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
