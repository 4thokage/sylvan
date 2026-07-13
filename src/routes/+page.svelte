<script lang="ts">
	import { parseCardList } from '$lib/parser';
	import type { WishlistCard, LookupResult } from '$lib/types';
	import { getCreatorFingerprint } from '$lib/device';
	import { resolve } from '$app/paths';
	import { getLocaleStore, t } from '$lib/i18n';
	import { useClerkContext } from 'svelte-clerk';
	import CardRow from '$lib/components/CardRow.svelte';
	import CardEditSheet from '$lib/components/CardEditSheet.svelte';
	import CardSearchBox from '$lib/components/CardSearchBox.svelte';

	let localeStore = getLocaleStore();
	let clerkCtx = useClerkContext();
	let isSignedIn = $derived(!!clerkCtx.user?.id);
	let input = $state('');
	let ownerName = $state('');
	let selectedGame = $state('mtg');
	let isSaving = $state(false);
	let savedId = $state<string | null>(null);
	let error = $state<string | null>(null);
	let wishlistCards = $state<WishlistCard[]>([]);
	let isLoading = $state(false);
	let lookupError = $state<string | null>(null);
	let selectedCard = $state<WishlistCard | null>(null);
	let isDrawerOpen = $state(false);
	let showCreate = $state(false);
	let userWishlists = $state<Array<{ id: string; created_at: string; cards: number }>>([]);
	let isLoadingWishlists = $state(false);

	const parsedCards = $derived(parseCardList(input));
	const hasCards = $derived(parsedCards.length > 0);
	const totalCards = $derived(parsedCards.reduce((sum, c) => sum + c.qty, 0));

	const games = [
		{ id: 'mtg', name: 'Magic: The Gathering' },
		{ id: 'pokemon', name: 'Pokémon TCG' },
		{ id: 'riftbound', name: 'Riftbound' }
	];

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	function makeCardDefaults(c: LookupResult, localId?: string): WishlistCard {
		return {
			localId: localId || crypto.randomUUID(),
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
			language: null
		};
	}

	$effect(() => {
		const cards = parsedCards;

		if (debounceTimer) clearTimeout(debounceTimer);

		if (cards.length === 0) {
			// Keep any cards added via the search box; only reset when the user
			// starts typing a list again (handled below).
			isLoading = false;
			lookupError = null;
			return;
		}

		isLoading = true;
		lookupError = null;

		debounceTimer = setTimeout(async () => {
			try {
				const response = await fetch('/api/cards/lookup', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						cards: cards.map((c) => ({
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
					wishlistCards = result.data.cards.map((c: LookupResult) => makeCardDefaults(c));
				} else {
					lookupError = result.error?.message ?? 'Failed to fetch cards';
					wishlistCards = cards.map((c) => ({
						localId: crypto.randomUUID(),
						name: c.name,
						qty: c.qty,
						imageUrl: null,
						manaCost: null,
						condition: 'NM',
						finish: null,
						aftermarketSigned: false,
						isAltered: false,
						language: null
					}));
				}
			} catch {
				lookupError = 'Failed to fetch cards';
				wishlistCards = cards.map((c) => ({
					localId: crypto.randomUUID(),
					name: c.name,
					qty: c.qty,
					imageUrl: null,
					manaCost: null,
					condition: 'NM',
					finish: null,
					aftermarketSigned: false,
					isAltered: false,
					language: null
				}));
			} finally {
				isLoading = false;
			}
		}, 1000);
	});

	async function loadUserWishlists() {
		if (!isSignedIn) return;
		isLoadingWishlists = true;
		try {
			const res = await fetch('/api/wishlists');
			const result = await res.json();
			if (result.success && result.data?.wishlists) {
				userWishlists = result.data.wishlists.map((w: { id: string; created_at: string }) => ({
					id: w.id,
					created_at: w.created_at,
					cards: 0
				}));
			}
		} catch {
			// silently fail
		} finally {
			isLoadingWishlists = false;
		}
	}

	$effect(() => {
		if (isSignedIn) {
			loadUserWishlists();
		}
	});

	async function saveWishlist() {
		if (!hasCards || isSaving) return;

		isSaving = true;
		error = null;

		try {
			const fingerprint = getCreatorFingerprint();
			const response = await fetch('/api/save', {
				method: 'POST',
				body: JSON.stringify({
					cards: wishlistCards.map((c) => ({
						name: c.name,
						qty: c.qty,
						set: c.set,
						collector_number: c.collectorNumber,
						cardPrintingId: c.cardPrintingId,
						condition: c.condition,
						finish: c.finish,
						aftermarketSigned: c.aftermarketSigned,
						isAltered: c.isAltered,
						language: c.language
					})),
					creatorFingerprint: fingerprint,
					ownerName: ownerName || null,
					gameSlug: selectedGame
				}),
				headers: { 'Content-Type': 'application/json' }
			});

			const result = await response.json();

			if (result.success) {
				savedId = result.data.id;
				const url = `${window.location.origin}/${savedId}`;
				navigator.clipboard.writeText(url);
				loadUserWishlists();
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

	function openCardEdit(card: WishlistCard) {
		selectedCard = card;
		isDrawerOpen = true;
	}

	function handleSaveCard(updated: WishlistCard) {
		wishlistCards = wishlistCards.map((c) => (c.localId === updated.localId ? updated : c));
		isDrawerOpen = false;
		selectedCard = null;
	}

	function handleRemoveCard() {
		if (!selectedCard) return;
		wishlistCards = wishlistCards.filter((c) => c.localId !== selectedCard!.localId);
		isDrawerOpen = false;
		selectedCard = null;
	}

	function addCardFromSearch(card: WishlistCard) {
		const key = `${card.name}|${card.finish}|${card.condition}`;
		const existing = wishlistCards.find((c) => `${c.name}|${c.finish}|${c.condition}` === key);
		if (existing) {
			existing.qty += card.qty;
		} else {
			wishlistCards = [...wishlistCards, card];
		}
	}
</script>

<svelte:head>
	<title>Sylvan - {t($localeStore, 'wants.title')}</title>
	<meta name="description" content="Create and share your TCG wishlist" />
</svelte:head>

<div class="min-h-screen bg-surface text-text">
	<header class="border-b border-border px-6 py-4">
		<h1 class="text-xl font-semibold">{t($localeStore, 'wants.title')}</h1>
		<p class="mt-1 text-sm text-text-muted">{t($localeStore, 'wants.subtitle')}</p>
	</header>

	<main class="mx-auto max-w-7xl p-6">
		{#if savedId}
			<div class="py-12 text-center">
				<div class="mb-4 text-6xl">🎉</div>
				<h2 class="mb-2 text-2xl font-semibold">{t($localeStore, 'wants.saved')}</h2>
				<p class="mb-6 text-text-dim">{t($localeStore, 'wants.shareLink')}</p>
				<div class="mb-8 flex items-center justify-center gap-3">
					<input
						type="text"
						readonly
						value={`${typeof window !== 'undefined' ? window.location.origin : ''}/${savedId}`}
						class="w-80 rounded-lg border border-border-strong bg-surface-raised px-4 py-2 text-text-soft"
					/>
					<button
						onclick={copyShareLink}
						class="rounded-lg bg-accent-bg px-4 py-2 text-white transition-colors hover:bg-accent-hover"
					>
						{t($localeStore, 'wants.copy')}
					</button>
				</div>
				<button
					onclick={() => {
						savedId = null;
						input = '';
						showCreate = false;
					}}
					class="text-text-dim underline hover:text-text"
				>
					{t($localeStore, 'wants.createAnother')}
				</button>
			</div>
		{:else}
			{#if isSignedIn}
				<div class="mb-8">
					<div class="flex items-center justify-between mb-4">
						<h2 class="text-lg font-medium">{t($localeStore, 'wants.myWishlists')}</h2>
						<button
							onclick={() => (showCreate = true)}
							class="rounded-lg bg-accent-bg px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
						>
							{t($localeStore, 'wants.newWishlist')}
						</button>
					</div>
					{#if isLoadingWishlists}
						<div class="flex items-center gap-2 text-sm text-text-muted">
							<div
								class="h-4 w-4 animate-spin rounded-full border-2 border-border-strong border-t-emerald-500"
							></div>
							{t($localeStore, 'common.loading')}
						</div>
					{:else if userWishlists.length === 0}
						<p class="text-sm text-text-muted">{t($localeStore, 'wants.noWishlists')}</p>
					{:else}
						<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{#each userWishlists as wishlist (wishlist.id)}
								<a
									href={resolve(`/${wishlist.id}`)}
									class="flex items-center justify-between rounded-lg border border-border bg-surface-raised p-4 transition-colors hover:border-border-strong"
								>
									<div>
										<p class="font-medium text-text">{wishlist.id}</p>
										<p class="text-xs text-text-muted">
											{t($localeStore, 'wants.created')}
											{new Date(wishlist.created_at).toLocaleDateString()}
										</p>
									</div>
									<span class="text-xs text-text-muted"
										>{wishlist.cards} {t($localeStore, 'wants.cards')}</span
									>
								</a>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			{#if !isSignedIn || showCreate || userWishlists.length === 0}
				<div class="mb-6 flex items-center gap-4">
					<span class="text-sm font-medium text-text-dim"
						>{t($localeStore, 'wants.gameLabel')}:</span
					>
					<div class="flex gap-2">
						{#each games as game (game.id)}
							<button
								onclick={() => (selectedGame = game.id)}
								class="rounded-lg px-4 py-2 text-sm transition-colors {selectedGame === game.id
									? 'bg-accent-bg text-white'
									: 'border border-border-strong text-text-dim hover:bg-surface-card'}"
							>
								{game.name}
							</button>
						{/each}
					</div>
				</div>

				<div class="grid gap-8 lg:grid-cols-2">
					<div class="space-y-4">
						<div>
							<label for="card-list" class="mb-2 block text-sm font-medium text-text-dim">
								{t($localeStore, 'wants.pasteList')}
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
							placeholder={t($localeStore, 'wants.cardPlaceholder')}
							class="h-[500px] w-full resize-none rounded-xl border border-border bg-surface-raised p-4 font-mono text-sm leading-relaxed text-text placeholder-text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/50 focus:outline-none"
						></textarea>
						<div class="flex items-center justify-between gap-4">
							{#if !isSignedIn}
								<div class="flex-1">
									<input
										type="text"
										bind:value={ownerName}
										placeholder={t($localeStore, 'wants.yourName')}
										class="w-full rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm text-text placeholder-text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/50 focus:outline-none"
									/>
								</div>
							{/if}
							<div class="flex items-center gap-4">
								<p class="text-sm text-text-muted">
									{parsedCards.length}
									{t($localeStore, 'wants.uniqueCards')} · {totalCards}
									{t($localeStore, 'wants.total')}
								</p>
								<button
									onclick={saveWishlist}
									disabled={!hasCards || isSaving}
									class="rounded-lg bg-accent-bg px-6 py-2 font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-hover"
								>
									{isSaving ? t($localeStore, 'wants.saving') : t($localeStore, 'wants.save')}
								</button>
							</div>
						</div>
						{#if error}
							<p class="text-sm text-danger">{error}</p>
						{/if}
					</div>

					<div class="space-y-4">
						<div class="flex items-center justify-between">
							<span class="block text-sm font-medium text-text-dim"
								>{t($localeStore, 'wants.preview')}</span
							>
							<span class="text-xs text-text-muted">{t($localeStore, 'wants.livePreview')}</span>
						</div>

						{#if isLoading}
							<div
								class="flex h-[500px] items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-raised/50"
							>
								<div class="text-center">
									<div
										class="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-border-strong border-t-emerald-500"
									></div>
									<p class="text-sm text-text-dim">{t($localeStore, 'wants.fetching')}</p>
								</div>
							</div>
						{:else if lookupError}
							<div
								class="flex h-[500px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-surface-raised/50 p-6"
							>
								<p class="text-center text-sm text-danger">{lookupError}</p>
								<p class="text-center text-xs text-text-muted">
									{t($localeStore, 'wants.imagesUnavailable')}
								</p>
							</div>
						{:else if hasCards}
							<div class="max-h-[500px] space-y-2 overflow-y-auto pr-2">
								{#each wishlistCards as card (card.localId)}
									<CardRow {card} onClick={() => openCardEdit(card)} />
								{/each}
							</div>
						{:else}
							<div
								class="flex h-[500px] items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-raised/50"
							>
								<p class="text-sm text-text-muted">{t($localeStore, 'wants.typeToPreview')}</p>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		{/if}
	</main>
</div>

{#if selectedCard}
	<CardEditSheet
		card={selectedCard}
		isOpen={isDrawerOpen}
		gameSlug={selectedGame}
		isCollection={false}
		onSave={handleSaveCard}
		onRemove={handleRemoveCard}
		onClose={() => {
			isDrawerOpen = false;
			selectedCard = null;
		}}
	/>
{/if}
