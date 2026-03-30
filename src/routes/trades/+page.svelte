<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { onMount, onDestroy } from 'svelte';
	import { supabase } from '$lib/supabase-client';
	import { getCards, type WishlistCard } from '$lib/scryfall/api';
	import { useClerkContext } from 'svelte-clerk/client';

	interface TradeMatch {
		wishlistId: string;
		wishlistOwner: string;
		cardsYouHave: { name: string; qty: number; price: number }[];
		valueYouGive: number;
		score: number;
	}

	const ctx = useClerkContext();
	const userId = $derived(ctx?.auth?.userId ?? null);

	let tradeMatches = $state<TradeMatch[]>([]);
	let isLoading = $state(true);
	let collectionCards = $state<WishlistCard[]>([]);
	let isRealtimeConnected = $state(false);
	let lastUpdate = $state<Date | null>(null);

	interface WishlistData {
		id: string;
		owner_name: string;
		clerk_user_id: string;
		cards: WishlistCard[];
	}

	async function loadWishlists(): Promise<WishlistData[]> {
		const { data: wishlists } = await supabase
			.from('wishlists')
			.select('id, owner_name, clerk_user_id, cards')
			.eq('visibility', 'public')
			.limit(100);

		if (!wishlists) return [];

		const enriched: WishlistData[] = [];
		for (const w of wishlists) {
			if (w.cards && Array.isArray(w.cards)) {
				const result = await getCards(w.cards);
				enriched.push({
					id: w.id,
					owner_name: w.owner_name || 'Anonymous',
					clerk_user_id: w.clerk_user_id,
					cards: result.cards
				});
			}
		}
		return enriched;
	}

	async function loadCollection() {
		if (!userId) return;

		const { data } = await supabase
			.from('user_collections')
			.select('cards')
			.eq('clerk_user_id', userId)
			.single();

		if (data?.cards && Array.isArray(data.cards)) {
			const result = await getCards(data.cards);
			collectionCards = result.cards;
		}
	}

	function calculateTrades(wishlists: WishlistData[], collection: WishlistCard[]): TradeMatch[] {
		const matches: TradeMatch[] = [];

		for (const wishlist of wishlists) {
			const cardsYouHave: { name: string; qty: number; price: number }[] = [];

			let valueYouGive = 0;
			let wishlistValue = 0;

			for (const card of wishlist.cards) {
				const cardLower = card.name.toLowerCase();
				const inCollection = collection.find((c) => c.name.toLowerCase() === cardLower);

				const price = parseFloat(card.prices?.eur || '0');
				wishlistValue += price * card.qty;

				if (inCollection && inCollection.qty > 0) {
					const canGive = Math.min(card.qty, inCollection.qty);
					cardsYouHave.push({
						name: card.name,
						qty: canGive,
						price
					});
					valueYouGive += price * canGive;
				}
			}

			if (cardsYouHave.length > 0) {
				const valueRatio =
					valueYouGive > 0 ? Math.min(valueYouGive / Math.max(wishlistValue, 0.01), 1) : 0;
				const cardRatio = cardsYouHave.length / Math.max(wishlist.cards.length, 1);
				const score = Math.round(valueRatio * 50 + cardRatio * 50);

				matches.push({
					wishlistId: wishlist.id,
					wishlistOwner: wishlist.owner_name,
					cardsYouHave,
					valueYouGive,
					score
				});
			}
		}

		return matches.sort((a, b) => b.score - a.score);
	}

	async function refreshTrades() {
		isLoading = true;
		const wishlists = await loadWishlists();
		tradeMatches = calculateTrades(wishlists, collectionCards);
		lastUpdate = new Date();
		isLoading = false;
	}

	onMount(async () => {
		await loadCollection();
		await refreshTrades();

		supabase
			.channel('wishlists')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'wishlists' }, () => {
				refreshTrades();
			})
			.subscribe((status) => {
				isRealtimeConnected = status === 'SUBSCRIBED';
			});
	});

	onDestroy(() => {
		supabase.removeAllChannels();
	});
</script>

<svelte:head>
	<title>Sylvan Web - Trade Suggestions</title>
</svelte:head>

<div class="mx-auto max-w-7xl p-6">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight text-emerald-400">Trade Suggestions</h1>
			<p class="mt-1 text-sm text-zinc-500">
				{#if isRealtimeConnected}
					<span class="text-emerald-400">●</span> Live updates enabled
				{:else}
					Connecting to live updates...
				{/if}
				{#if lastUpdate}
					<span class="ml-2">Last updated: {lastUpdate.toLocaleTimeString()}</span>
				{/if}
			</p>
		</div>
		<button
			onclick={refreshTrades}
			disabled={isLoading}
			class="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
		>
			{isLoading ? 'Loading...' : 'Refresh'}
		</button>
	</div>

	{#if !collectionCards.length}
		<div class="mb-6 rounded-lg bg-yellow-900/20 p-4 text-sm text-yellow-400">
			<a href="/collection" class="underline" data-sveltekit-preload-data
				>Sign in and import your collection</a
			> to see personalized trade suggestions!
		</div>
	{/if}

	{#if isLoading && tradeMatches.length === 0}
		<div class="flex h-40 items-center justify-center">
			<div class="text-center">
				<div
					class="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-zinc-700 border-t-emerald-500"
				></div>
				<p class="text-sm text-zinc-400">Finding trade matches...</p>
			</div>
		</div>
	{:else if tradeMatches.length === 0}
		<div class="flex h-40 items-center justify-center">
			<p class="text-zinc-400">No trade matches found yet. Create a wishlist to get started!</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each tradeMatches as match (match.wishlistId)}
				<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
					<div class="mb-3 flex items-center justify-between">
						<div>
							<h3 class="font-medium text-zinc-200">{match.wishlistOwner}'s Wishlist</h3>
							<a
								href="/{match.wishlistId}"
								class="text-sm text-emerald-400 hover:underline"
								data-sveltekit-preload-data
							>
								View wishlist →
							</a>
						</div>
						<div class="text-right">
							<div class="text-sm font-medium text-emerald-400">Match Score: {match.score}%</div>
						</div>
					</div>

					<div class="rounded bg-zinc-800/50 p-3">
						<h4 class="mb-2 text-xs font-medium text-zinc-400 uppercase">
							{match.wishlistOwner} is looking for:
						</h4>
						<div class="space-y-1">
							{#each match.cardsYouHave as card (card.name)}
								<div class="flex justify-between text-sm">
									<span class="text-zinc-300">{card.qty}x {card.name}</span>
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
