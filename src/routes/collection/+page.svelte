<script lang="ts">
	import { parseCardList, parseCsv, parseDeckbox, cardsToText } from '$lib/parser';
	import type { WishlistCard, LookupResult } from '$lib/types';
	import CardRow from '$lib/components/CardRow.svelte';
	import CardEditSheet from '$lib/components/CardEditSheet.svelte';

	let input = $state('');
	let collectionCards = $state<WishlistCard[]>([]);
	let isLoading = $state(false);
	let isSaving = $state(false);
	let isLoadingCollection = $state(true);
	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let selectedGame = $state('mtg');
	let selectedCard = $state<WishlistCard | null>(null);
	let isDrawerOpen = $state(false);

	import { useClerkContext } from 'svelte-clerk';
	import { getLocaleStore, t } from '$lib/i18n';

	let { data } = $props();
	let clerkCtx = useClerkContext();
	let localeStore = getLocaleStore();
	let currentUserId = $derived(clerkCtx.user?.id ?? data.user?.id ?? null);
	let isSignedIn = $derived(currentUserId !== null);

	const games = [
		{ id: 'mtg', name: 'Magic: The Gathering' },
		{ id: 'pokemon', name: 'Pokémon TCG' },
		{ id: 'riftbound', name: 'Riftbound' }
	];

	const parsedCards = $derived(parseCardList(input));
	const totalCards = $derived(collectionCards.reduce((sum, c) => sum + c.qty, 0));

	function makeCardDefaults(c: LookupResult): WishlistCard {
		return {
			name: c.name,
			qty: c.qty,
			imageUrl: c.imageUrl,
			manaCost: c.manaCost,
			prices: c.prices as WishlistCard['prices'],
			oracleId: c.oracleId,
			set: c.set,
			collectorNumber: c.collectorNumber,
			condition: 'NM',
			isFoil: false,
			isSigned: false,
			isAltered: false,
			language: 'en',
			isTradeable: true
		};
	}

	function detectFormat(text: string) {
		const textResult = parseCardList(text);
		if (textResult.length > 0) return textResult;

		const csvResult = parseCsv(text);
		if (csvResult.length > 0) return csvResult;

		const deckboxResult = parseDeckbox(text);
		if (deckboxResult.length > 0) return deckboxResult;

		return [];
	}

	$effect(() => {
		if (isSignedIn && isLoadingCollection) {
			loadCollection();
		}
	});

	async function loadCollection() {
		try {
			const response = await fetch(`/api/collection?game=${selectedGame}`);
			const result = await response.json();
			if (result.success && result.data?.cards) {
				const raw = result.data.cards.map(
					(c: {
						cardName: string;
						quantity: number;
						cardPrintingId: string;
						condition: string;
						isFoil: boolean;
						isSigned: boolean;
						isAltered: boolean;
						language: string;
						isTradeable: boolean;
					}) => ({
						name: c.cardName,
						qty: c.quantity,
						cardPrintingId: c.cardPrintingId,
						condition: c.condition,
						isFoil: c.isFoil,
						isSigned: c.isSigned,
						isAltered: c.isAltered,
						language: c.language,
						isTradeable: c.isTradeable
					})
				);
				if (raw.length > 0) {
					const lookupRes = await fetch('/api/cards/lookup', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							cards: raw,
							game: selectedGame
						})
					});
					const lookupData = await lookupRes.json();
					if (lookupData.success && lookupData.data?.cards) {
						collectionCards = lookupData.data.cards.map((c: LookupResult, i: number) => ({
							...makeCardDefaults(c),
							...raw[i]
						}));
					}
				}
			}
		} catch (err) {
			console.error('Failed to load collection', err);
		} finally {
			isLoadingCollection = false;
		}
	}

	async function saveCollection() {
		if (!currentUserId || isSaving) return;
		isSaving = true;
		message = null;

		const cardsToSave = collectionCards.map((card) => ({
			name: card.name,
			qty: card.qty,
			cardPrintingId: card.cardPrintingId || null,
			set: card.set,
			collector_number: card.collectorNumber,
			condition: card.condition,
			isFoil: card.isFoil,
			isSigned: card.isSigned,
			isAltered: card.isAltered,
			language: card.language,
			isTradeable: card.isTradeable
		}));

		try {
			const response = await fetch('/api/collection', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ cards: cardsToSave, gameSlug: selectedGame })
			});
			const result = await response.json();
			if (result.success) {
				message = { type: 'success', text: 'Collection saved!' };
				setTimeout(() => (message = null), 3000);
			} else {
				message = { type: 'error', text: result.error?.message || 'Failed to save' };
			}
		} catch {
			message = { type: 'error', text: 'Failed to save collection' };
		} finally {
			isSaving = false;
		}
	}

	async function clearCollection() {
		try {
			await fetch(`/api/collection?game=${selectedGame}`, { method: 'DELETE' });
			collectionCards = [];
			input = '';
			message = { type: 'success', text: 'Collection cleared!' };
			setTimeout(() => (message = null), 3000);
		} catch {
			message = { type: 'error', text: 'Failed to clear collection' };
		}
	}

	async function handleAdd() {
		if (!input.trim()) return;

		const parsed = detectFormat(input);
		if (parsed.length === 0) {
			message = { type: 'error', text: 'No cards found in input' };
			return;
		}

		isLoading = true;
		message = null;

		try {
			const response = await fetch('/api/cards/lookup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cards: parsed.map((c) => ({
						name: c.name,
						qty: c.qty,
						set: c.set,
						collector_number: c.collector_number
					})),
					game: selectedGame
				})
			});
			const result = await response.json();
			if (result.success && result.data?.cards) {
				const newCards = result.data.cards.map((c: LookupResult, i: number) => ({
					...makeCardDefaults(c),
					condition: parsed[i]?.condition || 'NM',
					isFoil: parsed[i]?.foil || false
				}));

				// Merge into existing collection
				const existingMap: Record<string, WishlistCard> = {};
				for (const c of collectionCards) {
					existingMap[c.name] = c;
				}

				for (const newCard of newCards) {
					const existing = existingMap[newCard.name];
					if (existing) {
						existing.qty += newCard.qty;
						existingMap[newCard.name] = existing;
					} else {
						existingMap[newCard.name] = newCard;
					}
				}

				collectionCards = Object.values(existingMap);
				input = '';
				message = {
					type: 'success',
					text: `Added ${newCards.length} unique cards`
				};
				setTimeout(() => (message = null), 3000);
			} else {
				message = { type: 'error', text: 'Failed to look up cards' };
			}
		} catch {
			message = { type: 'error', text: 'Failed to add cards' };
		} finally {
			isLoading = false;
		}
	}

	function handleExport() {
		if (collectionCards.length === 0) return;
		const cards = collectionCards.map((c) => ({ name: c.name, qty: c.qty }));
		const text = cardsToText(cards);
		navigator.clipboard.writeText(text);
		message = { type: 'success', text: 'Exported to clipboard!' };
		setTimeout(() => (message = null), 3000);
	}

	function openCardEdit(card: WishlistCard) {
		selectedCard = card;
		isDrawerOpen = true;
	}

	function handleSaveCard(updated: WishlistCard) {
		collectionCards = collectionCards.map((c) => (c.name === updated.name ? updated : c));
		isDrawerOpen = false;
		selectedCard = null;
	}

	function handleRemoveCard() {
		if (!selectedCard) return;
		collectionCards = collectionCards.filter((c) => c.name !== selectedCard!.name);
		isDrawerOpen = false;
		selectedCard = null;
	}

	async function switchGame(game: string) {
		selectedGame = game;
		collectionCards = [];
		isLoadingCollection = true;
		if (isSignedIn) {
			await loadCollection();
		}
	}
</script>

<svelte:head>
	<title>Sylvan - {t($localeStore, 'collection.title')}</title>
</svelte:head>

{#if !isSignedIn}
	<div class="flex min-h-[60vh] flex-col items-center justify-center">
		<div class="text-center">
			<h2 class="mb-4 text-2xl font-semibold">{t($localeStore, 'collection.signInRequired')}</h2>
			<p class="mb-6 text-text-dim">
				{t($localeStore, 'collection.signInDescription')}
			</p>
		</div>
	</div>
{:else}
	<div class="mx-auto max-w-7xl p-6">
		<div class="mb-6 flex items-center justify-between">
			<div>
				<h1 class="text-2xl font-semibold tracking-tight text-accent">
					{t($localeStore, 'collection.title')}
				</h1>
				<p class="mt-1 text-sm text-text-muted">
					{collectionCards.length}
					{t($localeStore, 'collection.unique')} · {totalCards}
					{t($localeStore, 'collection.total')}
				</p>
			</div>
			<div class="flex gap-2">
				<button
					onclick={handleExport}
					disabled={collectionCards.length === 0}
					class="rounded-lg border border-border-strong px-3 py-2 text-sm text-text-soft transition-colors hover:bg-surface-card"
				>
					{t($localeStore, 'collection.export')}
				</button>
				<button
					onclick={clearCollection}
					class="rounded-lg border border-border-strong px-3 py-2 text-sm text-text-soft transition-colors hover:bg-surface-card"
				>
					{t($localeStore, 'collection.clear')}
				</button>
				<button
					onclick={saveCollection}
					disabled={isSaving || collectionCards.length === 0}
					class="rounded-lg bg-accent-bg px-6 py-2 font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-hover"
				>
					{isSaving ? t($localeStore, 'collection.saving') : t($localeStore, 'collection.save')}
				</button>
			</div>
		</div>

		<div class="mb-6 flex items-center gap-4">
			<span class="text-sm font-medium text-text-dim">{t($localeStore, 'collection.game')}:</span>
			<div class="flex gap-2">
				{#each games as game (game.id)}
					<button
						onclick={() => switchGame(game.id)}
						class="rounded-lg px-4 py-2 text-sm transition-colors {selectedGame === game.id
							? 'bg-accent-bg text-white'
							: 'border border-border-strong text-text-dim hover:bg-surface-card'}"
					>
						{game.name}
					</button>
				{/each}
			</div>
		</div>

		{#if message}
			<div
				class="mb-4 rounded-lg p-3 text-sm {message.type === 'success'
					? 'bg-emerald-900/20 text-accent'
					: 'bg-danger-bg text-danger'}"
			>
				{message.text}
			</div>
		{/if}

		<div class="grid gap-8 lg:grid-cols-2">
			<div class="space-y-4">
				<label for="card-list" class="block text-sm font-medium text-text-dim">
					{t($localeStore, 'collection.addCards')}
				</label>
				<textarea
					id="card-list"
					bind:value={input}
					placeholder="4 Lightning Bolt&#10;4 Counterspell&#10;2 Sol Ring"
					class="h-[300px] w-full resize-none rounded-xl border border-border bg-surface-raised p-4 font-mono text-sm leading-relaxed text-text placeholder-text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/50 focus:outline-none"
				></textarea>
				<div class="flex items-center justify-between">
					<p class="text-sm text-text-muted">
						{parsedCards.length}
						{t($localeStore, 'collection.unique')} · {parsedCards.reduce(
							(sum, c) => sum + c.qty,
							0
						)}
						{t($localeStore, 'collection.total')}
					</p>
					<button
						onclick={handleAdd}
						disabled={!input.trim() || isLoading}
						class="rounded-lg bg-accent-bg px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-hover"
					>
						{isLoading ? t($localeStore, 'common.loading') : t($localeStore, 'collection.add')}
					</button>
				</div>
			</div>

			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<span class="block text-sm font-medium text-text-dim"
						>{t($localeStore, 'collection.title')}</span
					>
					<span class="text-xs text-text-muted">
						{collectionCards.length > 0
							? `${collectionCards.length} ${t($localeStore, 'collection.unique')}`
							: ''}
					</span>
				</div>

				{#if isLoadingCollection}
					<div
						class="flex h-[300px] items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-raised/50"
					>
						<div
							class="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-border-strong border-t-emerald-500"
						></div>
					</div>
				{:else if collectionCards.length > 0}
					<div class="max-h-[400px] space-y-2 overflow-y-auto pr-2">
						{#each collectionCards as card (card.cardPrintingId || card.name + '-' + (card.set || '') + '-' + (card.collectorNumber || ''))}
							<CardRow {card} onClick={() => openCardEdit(card)} />
						{/each}
					</div>
				{:else}
					<div
						class="flex h-[300px] items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-raised/50"
					>
						<p class="text-sm text-text-muted">{t($localeStore, 'collection.empty')}</p>
					</div>
				{/if}
			</div>
		</div>
	</div>

	{#if selectedCard}
		<CardEditSheet
			card={selectedCard}
			isOpen={isDrawerOpen}
			gameSlug={selectedGame}
			isCollection={true}
			onSave={handleSaveCard}
			onRemove={handleRemoveCard}
			onClose={() => {
				isDrawerOpen = false;
				selectedCard = null;
			}}
		/>
	{/if}
{/if}
