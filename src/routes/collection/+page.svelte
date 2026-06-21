<script lang="ts">
	import { parseCardList, parseCsv, parseDeckbox, cardsToText, cardsToCsv } from '$lib/parser';
	import type { WishlistCard, LookupResult } from '$lib/types';

	let input = $state('');
	let collectionCards = $state<WishlistCard[]>([]);
	let isLoading = $state(false);
	let isSaving = $state(false);
	let isLoadingCollection = $state(true);
	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let importFormat = $state('text');
	let showImportHelp = $state(false);
	let selectedGame = $state('mtg');

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

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		if (isSignedIn && isLoadingCollection) {
			loadCollection();
		}
	});

	$effect(() => {
		const cards = parsedCards;
		if (debounceTimer) clearTimeout(debounceTimer);
		if (cards.length === 0) {
			collectionCards = [];
			isLoading = false;
			return;
		}
		isLoading = true;
		debounceTimer = setTimeout(async () => {
			try {
				const response = await fetch('/api/cards/lookup', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						cards: cards.map((c) => ({ name: c.name, qty: c.qty })),
						game: selectedGame
					})
				});
				const result = await response.json();
				if (result.success && result.data?.cards) {
					collectionCards = result.data.cards.map((c: LookupResult) => ({
						name: c.name,
						qty: c.qty,
						imageUrl: c.imageUrl,
						manaCost: c.manaCost,
						prices: c.prices as WishlistCard['prices']
					}));
				}
			} catch {
				// fallback
			} finally {
				isLoading = false;
			}
		}, 1000);
	});

	async function loadCollection() {
		try {
			const response = await fetch(`/api/collection?game=${selectedGame}`);
			const result = await response.json();
			if (result.success && result.data?.cards) {
				const raw = result.data.cards.map((c: { cardName: string; quantity: number }) => ({
					name: c.cardName,
					qty: c.quantity
				}));
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
						collectionCards = lookupData.data.cards.map((c: LookupResult) => ({
							name: c.name,
							qty: c.qty,
							imageUrl: c.imageUrl,
							manaCost: c.manaCost,
							prices: c.prices as WishlistCard['prices']
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

		const cardsToSave = collectionCards.map((card) => ({ name: card.name, qty: card.qty }));

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

	function updateQty(cardName: string, delta: number) {
		collectionCards = collectionCards.map((card) => {
			if (card.name === cardName) {
				const newQty = Math.max(0, card.qty + delta);
				return { ...card, qty: newQty };
			}
			return card;
		});
	}

	async function handleImport() {
		if (!input.trim()) return;

		let parsed;
		switch (importFormat) {
			case 'csv':
				parsed = parseCsv(input);
				break;
			case 'deckbox':
				parsed = parseDeckbox(input);
				break;
			case 'text':
			default:
				parsed = parseCardList(input);
		}

		if (parsed.length === 0) {
			message = { type: 'error', text: 'No cards found in input' };
			return;
		}

		const merged = new Map<string, number>();
		for (const card of [...collectionCards, ...parsed]) {
			const key = card.name.toLowerCase();
			merged.set(key, (merged.get(key) || 0) + card.qty);
		}

		const mergedArray = Array.from(merged.entries()).map(([name, qty]) => ({ name, qty }));
		try {
			const response = await fetch('/api/cards/lookup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ cards: mergedArray, game: selectedGame })
			});
			const result = await response.json();
			if (result.success && result.data?.cards) {
				collectionCards = result.data.cards.map((c: LookupResult) => ({
					name: c.name,
					qty: c.qty,
					imageUrl: c.imageUrl,
					manaCost: c.manaCost,
					prices: c.prices as WishlistCard['prices']
				}));
				input = '';
				message = { type: 'success', text: `Imported ${parsed.length} unique cards` };
				setTimeout(() => (message = null), 3000);
			}
		} catch {
			message = { type: 'error', text: 'Failed to import cards' };
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
				<h1 class="text-2xl font-semibold tracking-tight text-accent">{t($localeStore, 'collection.title')}</h1>
				<p class="mt-1 text-sm text-text-muted">
					{collectionCards.length} {t($localeStore, 'collection.unique')} · {totalCards} {t($localeStore, 'collection.total')}
				</p>
			</div>
			<div class="flex gap-2">
				<button onclick={handleExport} disabled={collectionCards.length === 0}
					class="rounded-lg border border-border-strong px-3 py-2 text-sm text-text-soft transition-colors hover:bg-surface-card">
					{t($localeStore, 'collection.export')}
				</button>
				<button onclick={clearCollection}
					class="rounded-lg border border-border-strong px-3 py-2 text-sm text-text-soft transition-colors hover:bg-surface-card">
					{t($localeStore, 'collection.clear')}
				</button>
				<button onclick={saveCollection} disabled={isSaving || collectionCards.length === 0}
					class="rounded-lg bg-accent-bg px-6 py-2 font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-hover">
					{isSaving ? t($localeStore, 'collection.saving') : t($localeStore, 'collection.save')}
				</button>
			</div>
		</div>

		<div class="mb-6 flex items-center gap-4">
			<span class="text-sm font-medium text-text-dim">{t($localeStore, 'collection.game')}:</span>
			<div class="flex gap-2">
				{#each games as game}
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
				class="mb-4 rounded-lg p-3 text-sm {message.type === 'success' ? 'bg-emerald-900/20 text-accent' : 'bg-danger-bg text-danger'}"
			>
				{message.text}
			</div>
		{/if}

		<div class="grid gap-8 lg:grid-cols-2">
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<label for="card-list" class="text-sm font-medium text-text-dim">{t($localeStore, 'collection.addCards')}</label>
					<div class="flex items-center gap-2">
						<select
							bind:value={importFormat}
							class="rounded border border-border-strong bg-surface-raised px-2 py-1 text-xs text-text-soft"
						>
							<option value="text">{t($localeStore, 'collection.importFormat.text')}</option>
							<option value="csv">{t($localeStore, 'collection.importFormat.csv')}</option>
							<option value="deckbox">{t($localeStore, 'collection.importFormat.deckbox')}</option>
						</select>
						<button
							onclick={() => showImportHelp = !showImportHelp}
							class="text-xs text-text-muted hover:text-text-soft"
						>
							Help
						</button>
					</div>
				</div>

				<textarea
					id="card-list"
					bind:value={input}
					placeholder="4 Lightning Bolt&#10;4 Counterspell&#10;2 Sol Ring"
					class="h-[300px] w-full resize-none rounded-xl border border-border bg-surface-raised p-4 font-mono text-sm leading-relaxed text-text placeholder-text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/50 focus:outline-none"
				></textarea>

				<div class="flex items-center justify-between">
					<p class="text-sm text-text-muted">
						{parsedCards.length} {t($localeStore, 'collection.unique')} · {parsedCards.reduce((sum, c) => sum + c.qty, 0)} {t($localeStore, 'collection.total')}
					</p>
					<button
						onclick={handleImport}
						disabled={!input.trim()}
						class="rounded-lg bg-accent-bg px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-hover"
					>
						{t($localeStore, 'collection.import')}
					</button>
				</div>
			</div>

			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<span class="text-sm font-medium text-text-dim">{t($localeStore, 'collection.title')}</span>
					<span class="text-xs text-text-muted">
						{collectionCards.length > 0 ? `${collectionCards.length} ${t($localeStore, 'collection.unique')}` : ''}
					</span>
				</div>

				{#if isLoadingCollection || isLoading}
					<div class="flex h-[300px] items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-raised/50">
						<div class="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-border-strong border-t-emerald-500"></div>
					</div>
				{:else if collectionCards.length > 0}
					<div class="max-h-[400px] overflow-y-auto pr-2">
						{#each collectionCards as card (card.name)}
							<div class="mb-2 flex items-center gap-3 rounded-lg border border-border bg-surface-raised p-3">
								<div class="flex flex-1 items-center gap-3">
									{#if card.imageUrl}
										<img src={card.imageUrl} alt={card.name} class="h-12 w-9 rounded object-cover" loading="lazy" />
									{/if}
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm text-text-soft">{card.name}</p>
									</div>
								</div>
								<div class="flex items-center gap-2">
									<button onclick={() => updateQty(card.name, -1)}
										class="flex h-7 w-7 items-center justify-center rounded bg-surface-card text-text-dim hover:bg-surface-hover hover:text-text">-</button>
									<span class="w-8 text-center text-sm font-medium text-text">{card.qty}</span>
									<button onclick={() => updateQty(card.name, 1)}
										class="flex h-7 w-7 items-center justify-center rounded bg-surface-card text-text-dim hover:bg-surface-hover hover:text-text">+</button>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="flex h-[300px] items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-raised/50">
						<p class="text-sm text-text-muted">{t($localeStore, 'collection.empty')}</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
