<script lang="ts">
	import { useClerkContext } from 'svelte-clerk/client';
	import { supabase } from '$lib/supabase-client';
	import { getCards, type WishlistCard } from '$lib/scryfall/api';
	import ScannerView from '$lib/components/ScannerView.svelte';
	import { scannedCards } from '$lib/scanner/store';
	import type { ScannedCard } from '$lib/scanner/types';

	let detectedCardsValue = $state<ScannedCard[]>([]);
	let isSignedIn = $state(false);
	let currentUserId = $state<string | null>(null);
	let isSaving = $state(false);
	let saveMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let isLoadingCollection = $state(false);
	let collectionCards = $state<WishlistCard[]>([]);

	const ctx = useClerkContext();
	const userId = $derived(ctx?.auth?.userId ?? null);

	$effect(() => {
		isSignedIn = userId !== null && userId !== undefined;
		currentUserId = userId;
	});

	$effect(() => {
		detectedCardsValue = $scannedCards;
	});

	async function saveToCollection() {
		if (!currentUserId || detectedCardsValue.length === 0 || isSaving) return;

		isSaving = true;
		saveMessage = null;

		try {
			const cardsToSave = detectedCardsValue.map((card) => ({
				name: card.name,
				qty: card.qty
			}));

			const { data: existing } = await supabase
				.from('user_collections')
				.select('cards')
				.eq('clerk_user_id', currentUserId)
				.single();

			let mergedCards = cardsToSave;
			if (existing?.cards && Array.isArray(existing.cards)) {
				interface CardEntry {
					name: string;
					qty: number;
				}
				mergedCards = [...existing.cards, ...cardsToSave].reduce<CardEntry[]>((acc, card) => {
					const existing = acc.find((c: CardEntry) => c.name === card.name);
					if (existing) {
						existing.qty += card.qty;
					} else {
						acc.push({ ...card });
					}
					return acc;
				}, []);
			}

			const { error } = await supabase.from('user_collections').upsert(
				{
					clerk_user_id: currentUserId,
					cards: mergedCards,
					updated_at: new Date().toISOString()
				},
				{ onConflict: 'clerk_user_id' }
			);

			if (error) {
				saveMessage = { type: 'error', text: 'Failed to save to collection' };
			} else {
				saveMessage = { type: 'success', text: 'Saved to collection!' };
				setTimeout(() => (saveMessage = null), 3000);
			}
		} catch {
			saveMessage = { type: 'error', text: 'Failed to save to collection' };
		} finally {
			isSaving = false;
		}
	}

	async function loadCollectionForDisplay() {
		if (!currentUserId) return;

		isLoadingCollection = true;
		const { data } = await supabase
			.from('user_collections')
			.select('cards')
			.eq('clerk_user_id', currentUserId)
			.single();

		if (data?.cards && Array.isArray(data.cards)) {
			const result = await getCards(data.cards);
			collectionCards = result.cards;
		}
		isLoadingCollection = false;
	}

	function handleCardsChange(cards: ScannedCard[]) {
		detectedCardsValue = cards;
	}
</script>

<svelte:head>
	<title>Sylvan - Card Scanner</title>
	<meta name="description" content="Scan Magic cards with your camera" />
</svelte:head>

<div class="flex h-[calc(100vh-73px)] flex-col">
	<div class="flex-1">
		<ScannerView onCardsChange={handleCardsChange} />
	</div>

	{#if detectedCardsValue.length > 0}
		<div class="border-t border-zinc-800 bg-zinc-900 p-4">
			<div class="mx-auto flex max-w-7xl items-center justify-between">
				<div class="flex items-center gap-4">
					<div class="flex items-center gap-2">
						<span class="font-medium text-white">
							{detectedCardsValue.reduce((sum, c) => sum + c.qty, 0)} cards
						</span>
						<span class="text-sm text-zinc-500">
							({detectedCardsValue.length} unique)
						</span>
					</div>
				</div>

				<div class="flex items-center gap-3">
					{#if saveMessage}
						<span
							class="text-sm {saveMessage.type === 'success' ? 'text-emerald-400' : 'text-red-400'}"
						>
							{saveMessage.text}
						</span>
					{/if}

					{#if isSignedIn}
						<button
							onclick={saveToCollection}
							disabled={isSaving}
							class="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
						>
							<span>Save to Collection</span>
						</button>
					{:else}
						<span class="text-sm text-zinc-500">Sign in to save</span>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
