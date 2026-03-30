<script lang="ts">
	import { parseCardList } from '$lib/parser';
	import { getCards, type WishlistCard } from '$lib/scryfall/api';
	import { supabase } from '$lib/supabase-client';
	import { useClerkContext } from 'svelte-clerk/client';

	let input = $state('');
	let collectionCards = $state<WishlistCard[]>([]);
	let isLoading = $state(false);
	let isSaving = $state(false);
	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let isSignedIn = $state(false);
	let currentUserId = $state<string | null>(null);

	const ctx = useClerkContext();
	const userId = $derived(ctx?.auth?.userId ?? null);

	$effect(() => {
		isSignedIn = userId !== null && userId !== undefined;
		currentUserId = userId;
		if (isSignedIn) {
			loadCollection();
		}
	});

	const parsedCards = $derived(parseCardList(input));
	const totalCards = $derived(collectionCards.reduce((sum, c) => sum + c.qty, 0));
	const totalEurValue = $derived(
		collectionCards.reduce((sum, card) => {
			const price = parseFloat(card.prices?.eur || '0');
			return sum + price * card.qty;
		}, 0)
	);

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		const cards = parsedCards;

		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		if (cards.length === 0) {
			collectionCards = [];
			isLoading = false;
			return;
		}

		isLoading = true;

		debounceTimer = setTimeout(async () => {
			const result = await getCards(cards);
			collectionCards = result.cards;
			isLoading = result.loading;
		}, 1000);
	});

	async function loadCollection() {
		if (!currentUserId) return;

		const { data } = await supabase
			.from('user_collections')
			.select('cards')
			.eq('clerk_user_id', currentUserId)
			.single();

		if (data?.cards && Array.isArray(data.cards)) {
			const result = await getCards(data.cards);
			collectionCards = result.cards;
		}
	}

	async function saveCollection() {
		if (!currentUserId || isSaving) return;

		isSaving = true;
		message = null;

		const cardsToSave = collectionCards.map((card) => ({
			name: card.name,
			qty: card.qty
		}));

		const { error } = await supabase.from('user_collections').upsert(
			{
				clerk_user_id: currentUserId,
				cards: cardsToSave,
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'clerk_user_id' }
		);

		if (error) {
			message = { type: 'error', text: 'Failed to save collection' };
		} else {
			message = { type: 'success', text: 'Collection saved!' };
			setTimeout(() => (message = null), 3000);
		}

		isSaving = false;
	}

	async function clearCollection() {
		if (!currentUserId) return;

		await supabase.from('user_collections').delete().eq('clerk_user_id', currentUserId);

		collectionCards = [];
		input = '';
		message = { type: 'success', text: 'Collection cleared!' };
		setTimeout(() => (message = null), 3000);
	}

	function updateQty(cardName: string, delta: number) {
		collectionCards = collectionCards.map((card) => {
			if (card.name === cardName) {
				const newQty = Math.max(0, card.qty + delta);
				return { ...card, qty: newQty };
			}
			return card;
		});
	}
</script>

<svelte:head>
	<title>Sylvan Web - My Collection</title>
</svelte:head>

{#if !isSignedIn}
	<div class="flex min-h-[60vh] flex-col items-center justify-center">
		<div class="text-center">
			<h2 class="mb-4 text-2xl font-semibold">Sign in to manage your collection</h2>
			<p class="mb-6 text-zinc-400">
				You need to be signed in to import and manage your Magic card collection.
			</p>
		</div>
	</div>
{:else}
	<div class="mx-auto max-w-7xl p-6">
		<div class="mb-6 flex items-center justify-between">
			<div>
				<h1 class="text-2xl font-semibold tracking-tight text-emerald-400">My Collection</h1>
				<p class="mt-1 text-sm text-zinc-500">
					{collectionCards.length} unique cards · {totalCards} total · €{totalEurValue.toFixed(2)}
				</p>
			</div>
			<div class="flex gap-3">
				<button
					onclick={clearCollection}
					class="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
				>
					Clear
				</button>
				<button
					onclick={saveCollection}
					disabled={isSaving || collectionCards.length === 0}
					class="rounded-lg bg-emerald-600 px-6 py-2 font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
				>
					{isSaving ? 'Saving...' : 'Save Collection'}
				</button>
			</div>
		</div>

		{#if message}
			<div
				class="mb-4 rounded-lg p-3 text-sm {message.type === 'success'
					? 'bg-emerald-900/20 text-emerald-400'
					: 'bg-red-900/20 text-red-400'}"
			>
				{message.text}
			</div>
		{/if}

		<div class="grid gap-8 lg:grid-cols-2">
			<div class="space-y-4">
				<label for="card-list" class="block text-sm font-medium text-zinc-400">
					Add cards to your collection
				</label>
				<textarea
					id="card-list"
					bind:value={input}
					placeholder="4 Lightning Bolt
4 Counterspell
2 Sol Ring"
					class="h-[400px] w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-mono text-sm leading-relaxed text-zinc-200 placeholder-zinc-600 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
				></textarea>
				<p class="text-sm text-zinc-500">
					{parsedCards.length} unique cards · {parsedCards.reduce((sum, c) => sum + c.qty, 0)} total
				</p>
			</div>

			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<span class="block text-sm font-medium text-zinc-400">Your Collection</span>
					<span class="text-xs text-zinc-600">Live preview</span>
				</div>

				{#if isLoading}
					<div
						class="flex h-[400px] items-center justify-center rounded-xl border-2 border-dashed border-zinc-800 bg-zinc-900/50"
					>
						<div class="text-center">
							<div
								class="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-zinc-700 border-t-emerald-500"
							></div>
							<p class="text-sm text-zinc-400">Loading...</p>
						</div>
					</div>
				{:else if collectionCards.length > 0}
					<div class="max-h-[400px] overflow-y-auto pr-2">
						{#each collectionCards as card (card.name)}
							<div
								class="mb-2 flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3"
							>
								<div class="flex flex-1 items-center gap-3">
									{#if card.imageUrl}
										<img
											src={card.imageUrl}
											alt={card.name}
											class="h-12 w-9 rounded object-cover"
											loading="lazy"
										/>
									{/if}
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm text-zinc-300">{card.name}</p>
										<p class="text-xs text-zinc-500">€{card.prices?.eur || '—'} each</p>
									</div>
								</div>
								<div class="flex items-center gap-2">
									<button
										onclick={() => updateQty(card.name, -1)}
										class="flex h-7 w-7 items-center justify-center rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
									>
										-
									</button>
									<span class="w-8 text-center text-sm font-medium text-zinc-200">
										{card.qty}
									</span>
									<button
										onclick={() => updateQty(card.name, 1)}
										class="flex h-7 w-7 items-center justify-center rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
									>
										+
									</button>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div
						class="flex h-[400px] items-center justify-center rounded-xl border-2 border-dashed border-zinc-800 bg-zinc-900/50"
					>
						<p class="text-sm text-zinc-600">Your collection is empty</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
