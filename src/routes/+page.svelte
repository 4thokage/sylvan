<script lang="ts">
	import { parseCardList } from '$lib/parser';
	import { getCards, type WishlistCard } from '$lib/scryfall/mock';

	let input = $state('');
	let isSaving = $state(false);
	let savedId = $state<string | null>(null);
	let error = $state<string | null>(null);
	let wishlistCards = $state<WishlistCard[]>([]);
	let isLoading = $state(false);
	let scryfallError = $state<string | null>(null);

	const parsedCards = $derived(parseCardList(input));
	const hasCards = $derived(parsedCards.length > 0);
	const totalCards = $derived(parsedCards.reduce((sum, c) => sum + c.qty, 0));

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		const cards = parsedCards;

		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		if (cards.length === 0) {
			wishlistCards = [];
			isLoading = false;
			scryfallError = null;
			return;
		}

		isLoading = true;
		scryfallError = null;

		debounceTimer = setTimeout(async () => {
			const result = await getCards(cards);
			wishlistCards = result.cards;
			isLoading = result.loading;
			scryfallError = result.error;
		}, 1000);
	});

	async function saveWishlist() {
		if (!hasCards || isSaving) return;

		isSaving = true;
		error = null;

		try {
			const response = await fetch('/api/save', {
				method: 'POST',
				body: JSON.stringify({ cards: wishlistCards }),
				headers: { 'Content-Type': 'application/json' }
			});

			const result = await response.json();

			if (result.success) {
				savedId = result.data.id;
				const url = `${window.location.origin}/${savedId}`;
				navigator.clipboard.writeText(url);
				window.location.href = `/${savedId}`;
			} else {
				error = result.error?.message ?? 'Failed to save wishlist';
			}
		} catch {
			error = 'Failed to save wishlist';
		} finally {
			isSaving = false;
		}
	}

	function copyShareLink() {
		if (!savedId) return;
		const url = `${window.location.origin}/${savedId}`;
		navigator.clipboard.writeText(url);
	}
</script>

<svelte:head>
	<title>Sylvan Web - MTG Wishlist</title>
	<meta name="description" content="Create and share your MTG wishlist" />
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-zinc-100">
	<header class="border-b border-zinc-800 px-6 py-4">
		<h1 class="text-2xl font-semibold tracking-tight text-emerald-400">Sylvan Web</h1>
		<p class="mt-1 text-sm text-zinc-500">MTG Wishlist Manager</p>
	</header>

	<main class="mx-auto max-w-7xl p-6">
		{#if savedId}
			<div class="py-12 text-center">
				<div class="mb-4 text-6xl">🎉</div>
				<h2 class="mb-2 text-2xl font-semibold">Wishlist Saved!</h2>
				<p class="mb-6 text-zinc-400">Share this link with friends</p>
				<div class="mb-8 flex items-center justify-center gap-3">
					<input
						type="text"
						readonly
						value={`${typeof window !== 'undefined' ? window.location.origin : ''}/${savedId}`}
						class="w-80 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-300"
					/>
					<button
						onclick={copyShareLink}
						class="rounded-lg bg-emerald-600 px-4 py-2 text-white transition-colors hover:bg-emerald-500"
					>
						Copy
					</button>
				</div>
				<button
					onclick={() => {
						savedId = null;
						input = '';
					}}
					class="text-zinc-400 underline hover:text-zinc-200"
				>
					Create another wishlist
				</button>
			</div>
		{:else}
			<div class="grid gap-8 lg:grid-cols-2">
				<div class="space-y-4">
					<label for="card-list" class="block text-sm font-medium text-zinc-400">
						Paste your card list
					</label>
					<textarea
						id="card-list"
						bind:value={input}
						placeholder="4 Lightning Bolt (CLB) 785
4 Counterspell
2 Sol Ring
1 Thespian Stage"
						class="h-[500px] w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-mono text-sm leading-relaxed text-zinc-200 placeholder-zinc-600 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
					></textarea>
					<div class="flex items-center justify-between">
						<p class="text-sm text-zinc-500">
							{parsedCards.length} unique cards · {totalCards} total
						</p>
						<button
							onclick={saveWishlist}
							disabled={!hasCards || isSaving}
							class="rounded-lg bg-emerald-600 px-6 py-2 font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
						>
							{isSaving ? 'Saving...' : 'Save Wishlist'}
						</button>
					</div>
					{#if error}
						<p class="text-sm text-red-400">{error}</p>
					{/if}
				</div>

				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<span class="block text-sm font-medium text-zinc-400">Preview</span>
						<span class="text-xs text-zinc-600">Live preview</span>
					</div>

					{#if isLoading}
						<div
							class="flex h-[500px] items-center justify-center rounded-xl border-2 border-dashed border-zinc-800 bg-zinc-900/50"
						>
							<div class="text-center">
								<div
									class="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-zinc-700 border-t-emerald-500"
								></div>
								<p class="text-sm text-zinc-400">Fetching card data...</p>
							</div>
						</div>
					{:else if scryfallError}
						<div
							class="flex h-[500px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-zinc-800 bg-zinc-900/50 p-6"
						>
							<p class="text-center text-sm text-red-400">{scryfallError}</p>
							<p class="text-center text-xs text-zinc-500">
								Card images may not be available, but you can still save your wishlist.
							</p>
						</div>
					{:else if hasCards}
						<div class="grid max-h-[500px] grid-cols-2 gap-4 overflow-y-auto pr-2 sm:grid-cols-3">
							{#each wishlistCards as card (card.name)}
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
					{:else}
						<div
							class="flex h-[500px] items-center justify-center rounded-xl border-2 border-dashed border-zinc-800 bg-zinc-900/50"
						>
							<p class="text-sm text-zinc-600">Cards will appear here as you type</p>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</main>
</div>
