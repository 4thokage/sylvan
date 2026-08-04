<script lang="ts">
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { parseCardList, parseCsv, parseDeckbox, cardsToText } from '$lib/parser';
	import type { WishlistCard, LookupResult } from '$lib/types';
	import CardTable from '$lib/components/CardTable.svelte';
	import { page } from '$app/stores';
	import {
		parseDisplayMode,
		normalizeName,
		groupByCardIdentity,
		formatCondition,
		formatPrice,
		priceToNumber
	} from '$lib/client/display-mode';
	import CardEditSheet from '$lib/components/CardEditSheet.svelte';
	import CardSearchBox from '$lib/components/CardSearchBox.svelte';
	import { createAutosave } from '$lib/client/autosave';
	import type { AutosaveHandle, AutosaveState } from '$lib/client/autosave';

	let input = $state('');
	let collectionCards = $state<WishlistCard[]>([]);
	let isLoading = $state(false);
	let isLoadingCollection = $state(true);
	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let autosaveState = $state<AutosaveState>({ status: 'idle', error: null });
	let selectedGame = $state('mtg');
	let selectedCard = $state<WishlistCard | null>(null);
	let isDrawerOpen = $state(false);

	let autosave: AutosaveHandle | null = null;

	import { useClerkContext } from 'svelte-clerk';
	import { getLocaleStore, t } from '$lib/i18n';

	let { data } = $props();
	let clerkCtx = useClerkContext();
	let localeStore = getLocaleStore();
	let currentUserId = $derived(clerkCtx.user?.id ?? data.user?.id ?? null);
	let isSignedIn = $derived(currentUserId !== null);

	let display = $derived(parseDisplayMode($page.url.searchParams.get('display'), 'stacks'));
	let stacksGroups = $derived(groupByCardIdentity(collectionCards));
	let collapsed = new SvelteSet<string>();

	function toggleGroup(key: string) {
		if (collapsed.has(key)) {
			collapsed.delete(key);
		} else {
			collapsed.add(key);
		}
	}

	function groupKey(group: WishlistCard[]): string {
		return group[0].cardId ?? normalizeName(group[0].name);
	}

	const games = [
		{ id: 'mtg', name: 'Magic: The Gathering' },
		{ id: 'pokemon', name: 'Pokémon TCG' },
		{ id: 'riftbound', name: 'Riftbound' }
	];

	const parsedCards = $derived(parseCardList(input));
	const totalCards = $derived(collectionCards.reduce((sum, c) => sum + c.qty, 0));

	function makeCardDefaults(c: LookupResult): WishlistCard {
		return {
			localId: crypto.randomUUID(),
			name: c.name,
			qty: c.qty,
			imageUrl: c.imageUrl,
			manaCost: c.manaCost,
			prices: c.prices as WishlistCard['prices'],
			cardPrintingId: c.cardPrintingId || null,
			set: c.set,
			collectorNumber: c.collectorNumber,
			finish: c.finish || null,
			condition: 'NM',
			aftermarketSigned: false,
			isAltered: false,
			language: null,
			isTradeable: true
		};
	}

	function detectFormat(text: string) {
		const textResult = parseCardList(text);
		if (textResult.length > 0) return textResult;

		const csvResult = parseCsv(text);
		if (csvResult.length > 0) return csvResult;

		const tcgplayerResult = parseTcgplayerCsv(text);
		if (tcgplayerResult.length > 0) return tcgplayerResult;

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
				const cards = result.data.cards.map(
					(c: {
						id: string;
						cardId: string;
						cardName: string;
						quantity: number;
						cardPrintingId: string;
						imageUrl: string | null;
						condition: 'NM' | 'LP' | 'MP' | 'HP' | 'DMG';
						aftermarketSigned: boolean;
						isAltered: boolean;
						isTradeable: boolean;
						marketPriceUsd: number | null;
						marketPriceEur: number | null;
						setCode: string | null;
						collectorNumber: string | null;
						finish: string | null;
						language: string | null;
					}) => ({
						localId: c.id,
						name: c.cardName,
						qty: c.quantity,
						imageUrl: c.imageUrl,
						cardPrintingId: c.cardPrintingId,
						cardId: c.cardId,
						condition: c.condition,
						aftermarketSigned: c.aftermarketSigned,
						isAltered: c.isAltered,
						isTradeable: c.isTradeable !== false,
						prices: {
							usd: c.marketPriceUsd?.toFixed(2) ?? null,
							eur: c.marketPriceEur?.toFixed(2) ?? null
						} as WishlistCard['prices'],
						set: c.setCode || undefined,
						collectorNumber: c.collectorNumber || undefined,
						finish: c.finish,
						language: c.language,
						manaCost: null
					})
				);

				collectionCards = cards;
			}
		} catch (err) {
			console.error('Failed to load collection', err);
		} finally {
			isLoadingCollection = false;
		}
	}

	function cardToSavePayload(card: WishlistCard) {
		return {
			name: card.name,
			qty: card.qty,
			cardPrintingId: card.cardPrintingId || null,
			set: card.set,
			collector_number: card.collectorNumber,
			condition: card.condition,
			finish: card.finish,
			aftermarketSigned: card.aftermarketSigned,
			isAltered: card.isAltered,
			isTradeable: card.isTradeable,
			language: card.language,
			location: null,
			notes: null
		};
	}

	async function persistCollection(snapshot: WishlistCard[], game: string) {
		if (!currentUserId) return;
		const response = await fetch('/api/collection', {
			method: 'POST',
			keepalive: true,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ cards: snapshot.map(cardToSavePayload), gameSlug: game })
		});
		const result = await response.json();
		if (!result.success) {
			throw new Error(result.error?.message || 'Failed to save');
		}
		const errors: string[] = result.data?.errors || [];
		if (errors.length > 0) {
			message = {
				type: 'error',
				text: `Saved, but ${errors.length} card(s) could not be resolved: ${errors
					.slice(0, 3)
					.join(', ')}${errors.length > 3 ? '…' : ''}`
			};
		}
	}

	$effect(() => {
		if (!isSignedIn || isLoadingCollection) {
			autosave?.dispose();
			autosave = null;
			return;
		}
		if (!autosave) {
			autosave = createAutosave({
				debounceMs: 2000,
				persist: (snapshot) => persistCollection(snapshot as WishlistCard[], selectedGame),
				onState: (s) => {
					autosaveState = s;
				}
			});
		}
		return () => {
			autosave?.dispose();
			autosave = null;
		};
	});

	async function clearCollection() {
		autosave?.cancelPending();
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
					finish: parsed[i]?.foil ? 'foil' : c.finish || null
				}));

				// Merge into existing collection by homogeneous stack tuple.
				const existingMap = new SvelteMap<string, WishlistCard>();
				for (const c of collectionCards) {
					const key = `${c.cardPrintingId || c.name}|${c.condition}|${c.aftermarketSigned}|${c.isAltered}`;
					existingMap.set(key, c);
				}

				for (const newCard of newCards) {
					const key = `${newCard.cardPrintingId || newCard.name}|${newCard.condition}|${newCard.aftermarketSigned}|${newCard.isAltered}`;
					const existing = existingMap.get(key);
					if (existing) {
						existing.qty += newCard.qty;
						existingMap.set(key, existing);
					} else {
						existingMap.set(key, newCard);
					}
				}

				collectionCards = Array.from(existingMap.values());
				autosave?.markDirty(collectionCards);
				input = '';
				message = {
					type: 'success',
					text: `Added ${newCards.length} cards`
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

	function stackKey(card: WishlistCard): string {
		return `${card.set || card.name}|${card.collectorNumber}|${card.finish}|${card.condition}|${card.aftermarketSigned}|${card.isAltered}`;
	}

	function addCardFromSearch(card: WishlistCard) {
		const key = stackKey(card);
		const existing = collectionCards.find((c) => stackKey(c) === key);
		if (existing) {
			existing.qty += card.qty;
		} else {
			collectionCards = [...collectionCards, card];
		}
		message = { type: 'success', text: `Added ${card.name}` };
		setTimeout(() => (message = null), 3000);
		autosave?.markDirty(collectionCards);
	}

	async function handleFile(event: Event) {
		const inputEl = event.target as HTMLInputElement;
		const file = inputEl.files?.[0];
		if (!file) return;
		try {
			const text = await file.text();
			input = text;
			message = { type: 'success', text: `Loaded ${file.name}` };
			setTimeout(() => (message = null), 3000);
		} catch {
			message = { type: 'error', text: 'Failed to read file' };
		} finally {
			inputEl.value = '';
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
		collectionCards = collectionCards.map((c) => (c.localId === updated.localId ? updated : c));
		autosave?.markDirty(collectionCards);
		isDrawerOpen = false;
		selectedCard = null;
	}

	function handleRemoveCard() {
		if (!selectedCard) return;
		collectionCards = collectionCards.filter((c) => c.localId !== selectedCard!.localId);
		autosave?.markDirty(collectionCards);
		isDrawerOpen = false;
		selectedCard = null;
	}

	async function switchGame(game: string) {
		if (game === selectedGame) return;
		if (autosave) {
			await autosave.flushNow();
			autosave.cancelPending();
		}
		selectedGame = game;
		collectionCards = [];
		isLoadingCollection = true;
		if (isSignedIn) {
			await loadCollection();
		}
	}
</script>

<svelte:head>
	<title>Sylvan - {t($localeStore, 'haves.title')}</title>
</svelte:head>

{#if !isSignedIn}
	<div class="flex min-h-[60vh] flex-col items-center justify-center">
		<div class="text-center">
			<h2 class="mb-4 text-2xl font-semibold">{t($localeStore, 'haves.signInRequired')}</h2>
			<p class="mb-6 text-text-dim">
				{t($localeStore, 'haves.signInDescription')}
			</p>
		</div>
	</div>
{:else}
	<div class="mx-auto max-w-7xl p-6">
		<div class="mb-6 flex items-center justify-between">
			<div>
				<h1 class="text-2xl font-semibold tracking-tight text-accent">
					{t($localeStore, 'haves.title')}
				</h1>
				<p class="mt-1 text-sm text-text-muted">
					{collectionCards.length}
					{t($localeStore, 'haves.unique')} · {totalCards}
					{t($localeStore, 'haves.total')}
				</p>
			</div>
			<div class="flex gap-2">
				<button
					onclick={handleExport}
					disabled={collectionCards.length === 0}
					class="rounded-lg border border-border-strong px-3 py-2 text-sm text-text-soft transition-colors hover:bg-surface-card"
				>
					{t($localeStore, 'haves.export')}
				</button>
				<button
					onclick={clearCollection}
					class="rounded-lg border border-border-strong px-3 py-2 text-sm text-text-soft transition-colors hover:bg-surface-card"
				>
					{t($localeStore, 'haves.clear')}
				</button>
				{#if autosaveState.status === 'saving'}
					<span
						class="inline-flex items-center gap-2 rounded-lg border border-border-strong px-3 py-2 text-sm text-text-soft"
					>
						<span
							class="h-3 w-3 animate-spin rounded-full border-2 border-border-strong border-t-emerald-500"
						></span>
						{t($localeStore, 'haves.saving')}
					</span>
				{:else if autosaveState.status === 'saved'}
					<span class="rounded-lg border border-border-strong px-3 py-2 text-sm text-text-muted">
						{t($localeStore, 'haves.saved')}
					</span>
				{:else if autosaveState.status === 'error'}
					<span
						class="rounded-lg border border-danger-bg px-3 py-2 text-sm text-danger"
						title={autosaveState.error || ''}
					>
						{t($localeStore, 'haves.saveError')}
					</span>
				{/if}
			</div>
		</div>

		<div class="mb-6 flex items-center gap-4">
			<span class="text-sm font-medium text-text-dim">{t($localeStore, 'haves.game')}:</span>
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
				<div>
					<label for="card-list" class="mb-2 block text-sm font-medium text-text-dim">
						{t($localeStore, 'haves.addCards')}
					</label>
					<CardSearchBox
						gameSlug={selectedGame}
						placeholder="Search a card to add it directly…"
						onSelect={addCardFromSearch}
					/>
					<p class="mt-1 text-xs text-text-muted">
						Or paste a list below (MTG Arena, Moxfield, Archidekt, CSV, Deckbox, TCGplayer).
					</p>
				</div>
				<textarea
					id="card-list"
					bind:value={input}
					placeholder="4 Lightning Bolt&#10;4 Counterspell&#10;2 Sol Ring"
					class="h-[300px] w-full resize-none rounded-xl border border-border bg-surface-raised p-4 font-mono text-sm leading-relaxed text-text placeholder-text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/50 focus:outline-none"
				></textarea>
				<div class="flex items-center justify-between gap-3">
					<p class="text-sm text-text-muted">
						{parsedCards.length}
						{t($localeStore, 'haves.unique')} · {parsedCards.reduce((sum, c) => sum + c.qty, 0)}
						{t($localeStore, 'haves.total')}
					</p>
					<div class="flex items-center gap-2">
						<label
							class="cursor-pointer rounded-lg border border-border-strong px-3 py-2 text-sm text-text-soft transition-colors hover:bg-surface-card"
						>
							Upload
							<input type="file" accept=".txt,.csv" class="hidden" onchange={handleFile} />
						</label>
						<button
							onclick={handleAdd}
							disabled={!input.trim() || isLoading}
							class="rounded-lg bg-accent-bg px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-hover"
						>
							{isLoading ? t($localeStore, 'common.loading') : t($localeStore, 'haves.add')}
						</button>
					</div>
				</div>
			</div>

			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<span class="block text-sm font-medium text-text-dim"
						>{t($localeStore, 'haves.title')}</span
					>
					<span class="text-xs text-text-muted">
						{collectionCards.length > 0
							? `${collectionCards.length} ${t($localeStore, 'haves.unique')}`
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
					{#if display === 'table'}
						<div class="max-h-[400px] overflow-y-auto pr-2">
							<CardTable
								rows={collectionCards}
								rowKey={(c) => c.cardPrintingId ?? c.localId ?? c.name}
								onRowClick={(card) => openCardEdit(card)}
								columns={[
									{
										key: 'name',
										label: 'display.columns.name',
										sortValue: (c) => c.name,
										render: (c) => c.name
									},
									{
										key: 'qty',
										label: 'display.columns.qty',
										align: 'right',
										sortValue: (c) => c.qty,
										render: (c) => String(c.qty)
									},
									{
										key: 'set',
										label: 'display.columns.set',
										sortValue: (c) => c.set ?? '',
										render: (c) => (c.set ?? '').toUpperCase()
									},
									{
										key: 'collectorNumber',
										label: 'display.columns.collectorNumber',
										sortValue: (c) => c.collectorNumber ?? '',
										render: (c) => c.collectorNumber ?? ''
									},
									{
										key: 'finish',
										label: 'display.columns.finish',
										sortValue: (c) => c.finish ?? '',
										render: (c) => (c.finish && c.finish !== 'non-foil' ? c.finish : '')
									},
									{
										key: 'condition',
										label: 'display.columns.condition',
										sortValue: (c) => c.condition,
										render: (c) => formatCondition(c.condition)
									},
									{
										key: 'language',
										label: 'display.columns.language',
										sortValue: (c) => c.language ?? '',
										render: (c) => c.language ?? ''
									},
									{
										key: 'signed',
										label: 'display.columns.signed',
										sortValue: (c) => (c.aftermarketSigned ? 1 : 0),
										render: (c) => (c.aftermarketSigned ? '✓' : '—')
									},
									{
										key: 'altered',
										label: 'display.columns.altered',
										sortValue: (c) => (c.isAltered ? 1 : 0),
										render: (c) => (c.isAltered ? '✓' : '—')
									},
									{
										key: 'tradeable',
										label: 'display.columns.tradeable',
										sortValue: (c) => (c.isTradeable ? 1 : 0),
										render: (c) => (c.isTradeable ? '✓' : '—')
									},
									{
										key: 'usd',
										label: 'display.columns.usd',
										align: 'right',
										sortValue: (c) => priceToNumber(c.prices?.usd),
										render: (c) => formatPrice(c.prices?.usd)
									},
									{
										key: 'eur',
										label: 'display.columns.eur',
										align: 'right',
										sortValue: (c) => priceToNumber(c.prices?.eur),
										render: (c) => formatPrice(c.prices?.eur, '€')
									}
								]}
							/>
						</div>
					{:else if display === 'visual'}
						<div class="max-h-[400px] overflow-y-auto pr-2">
							<div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
								{#each collectionCards as card (card.localId)}
									<button
										type="button"
										onclick={() => openCardEdit(card)}
										class="block w-full text-left"
									>
										<div
											class="relative aspect-[5/7] w-full overflow-hidden rounded-lg border border-border bg-surface-raised transition-colors hover:border-border-strong"
										>
											{#if card.imageUrl}
												<img
													src={card.imageUrl}
													alt={card.name}
													loading="lazy"
													class="absolute inset-0 h-full w-full object-cover transition-transform duration-200 hover:scale-105"
												/>
											{:else}
												<div class="flex h-full w-full items-center justify-center bg-surface-card">
													<span class="px-2 text-center text-xs text-text-muted">{card.name}</span>
												</div>
											{/if}
											<div
												class="absolute top-2 right-2 rounded bg-surface/90 px-2 py-0.5 text-xs font-bold text-text"
											>
												×{card.qty}
											</div>
										</div>
										<div class="border-t border-border p-2">
											<p class="truncate text-xs text-text-soft">{card.name}</p>
										</div>
									</button>
								{/each}
							</div>
						</div>
					{:else}
						<div class="max-h-[400px] space-y-2 overflow-y-auto pr-2">
							{#each stacksGroups as group (group[0].cardId ?? normalizeName(group[0].name))}
								{@const identity = group[0]}
								{@const totalQty = group.reduce((sum, c) => sum + c.qty, 0)}
								{@const key = groupKey(group)}
								<div class="overflow-hidden rounded-lg border border-border bg-surface-raised">
									<button
										type="button"
										onclick={() => toggleGroup(key)}
										class="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-surface-card"
									>
										{#if identity.imageUrl}
											<img
												src={identity.imageUrl}
												alt=""
												class="h-12 w-8 rounded object-cover"
												loading="lazy"
											/>
										{:else}
											<div
												class="flex h-12 w-8 items-center justify-center rounded bg-surface-card text-[8px] text-text-muted"
											>
												?
											</div>
										{/if}
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium text-text-soft">{identity.name}</p>
											<p class="text-xs text-text-muted">
												{group.length}
												{t($localeStore, 'display.stackCount')} · ×{totalQty}
											</p>
										</div>
										<span class="text-text-muted">{collapsed.has(key) ? '+' : '−'}</span>
									</button>
									{#if !collapsed.has(key)}
										<div class="divide-y divide-border border-t border-border">
											{#each group as card (card.localId)}
												<button
													type="button"
													onclick={() => openCardEdit(card)}
													class="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-xs text-text-dim transition-colors hover:bg-surface-card"
												>
													<span class="min-w-0 truncate">
														{[
															formatCondition(card.condition),
															card.finish && card.finish !== 'non-foil' ? card.finish : '',
															card.set?.toUpperCase(),
															card.collectorNumber,
															card.language,
															card.aftermarketSigned ? 'Signed' : '',
															card.isAltered ? 'Altered' : ''
														]
															.filter(Boolean)
															.join(' · ')}
													</span>
													<span class="font-medium text-text">×{card.qty}</span>
												</button>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				{:else}
					<div
						class="flex h-[300px] items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-raised/50"
					>
						<p class="text-sm text-text-muted">{t($localeStore, 'haves.empty')}</p>
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
