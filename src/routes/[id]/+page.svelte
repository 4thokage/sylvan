<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	let { data } = $props();
	const wishlist = $derived(data.wishlist);
	const cards = $derived(
		wishlist.cards as Array<{
			name: string;
			qty: number;
			imageUrl: string | null;
			manaCost: string | null;
		}>
	);
	const totalCards = $derived(cards.reduce((sum, c) => sum + c.qty, 0));
</script>

<svelte:head>
	<title>Sylvan Web - Wishlist {data.wishlist.id}</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-zinc-100">
	<header class="border-b border-zinc-800 px-6 py-4">
		<div class="mx-auto flex max-w-7xl items-center justify-between">
			<div>
				<h1 class="text-2xl font-semibold tracking-tight text-emerald-400">Sylvan Web</h1>
				<p class="mt-1 text-sm text-zinc-500">Shared Wishlist</p>
			</div>
			<a
				href="/"
				class="text-sm text-zinc-400 transition-colors hover:text-zinc-200"
				data-sveltekit-preload-data
			>
				Create New →
			</a>
		</div>
	</header>

	<main class="mx-auto max-w-7xl p-6">
		<div class="mb-6 flex items-center justify-between">
			<p class="text-zinc-500">{cards.length} unique cards · {totalCards} total</p>
		</div>

		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
			{#each cards as card (card.name)}
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
			{/each}
		</div>
	</main>
</div>
