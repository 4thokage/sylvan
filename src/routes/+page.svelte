<script lang="ts">
	import { parseCardList } from '$lib/parser';
	import type { WishlistCard, LookupResult } from '$lib/types';
	import { getCreatorFingerprint } from '$lib/device';
	import { getLocaleStore, t } from '$lib/i18n';
	import { useClerkContext } from 'svelte-clerk';
	import CardRow from '$lib/components/CardRow.svelte';
	import CardEditSheet from '$lib/components/CardEditSheet.svelte';

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

	const parsedCards = $derived(parseCardList(input));
	const hasCards = $derived(parsedCards.length > 0);
	const totalCards = $derived(parsedCards.reduce((sum, c) => sum + c.qty, 0));

	const games = [
		{ id: 'mtg', name: 'Magic: The Gathering' },
		{ id: 'pokemon', name: 'Pokémon TCG' },
		{ id: 'riftbound', name: 'Riftbound' }
	];

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

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
			language: 'en'
		};
	}

	$effect(() => {
		const cards = parsedCards;

		if (debounceTimer) clearTimeout(debounceTimer);

		if (cards.length === 0) {
			wishlistCards = [];
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
						name: c.name,
						qty: c.qty,
						imageUrl: null,
						manaCost: null,
						condition: 'NM',
						isFoil: false,
						isSigned: false,
						isAltered: false,
						language: 'en'
					}));
				}
			} catch {
				lookupError = 'Failed to fetch cards';
				wishlistCards = cards.map((c) => ({
					name: c.name,
					qty: c.qty,
					imageUrl: null,
					manaCost: null,
					condition: 'NM',
					isFoil: false,
					isSigned: false,
					isAltered: false,
					language: 'en'
				}));
			} finally {
				isLoading = false;
			}
		}, 1000);
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
						imageUrl: c.imageUrl,
						manaCost: c.manaCost,
						oracleId: c.oracleId,
						condition: c.condition,
						isFoil: c.isFoil,
						isSigned: c.isSigned,
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
		wishlistCards = wishlistCards.map((c) => (c.name === updated.name ? updated : c));
		isDrawerOpen = false;
		selectedCard = null;
	}

	function handleRemoveCard() {
		if (!selectedCard) return;
		wishlistCards = wishlistCards.filter((c) => c.name !== selectedCard!.name);
		isDrawerOpen = false;
		selectedCard = null;
	}
</script>

<svelte:head>
	<title>Sylvan - {t($localeStore, 'home.title')}</title>
	<meta name="description" content="Create and share your TCG wishlist" />
</svelte:head>

<div class="min-h-screen bg-surface text-text">
	<header class="border-b border-border px-6 py-4">
		<p class="mt-1 text-sm text-text-muted">{t($localeStore, 'home.subtitle')}</p>
	</header>

	<main class="mx-auto max-w-7xl p-6">
		{#if savedId}
			<div class="py-12 text-center">
				<div class="mb-4 text-6xl">🎉</div>
				<h2 class="mb-2 text-2xl font-semibold">{t($localeStore, 'home.saved')}</h2>
				<p class="mb-6 text-text-dim">{t($localeStore, 'home.shareLink')}</p>
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
						{t($localeStore, 'home.copy')}
					</button>
				</div>
				<button
					onclick={() => {
						savedId = null;
						input = '';
					}}
					class="text-text-dim underline hover:text-text"
				>
					{t($localeStore, 'home.createAnother')}
				</button>
			</div>
		{:else}
			<div class="mb-6 flex items-center gap-4">
				<span class="text-sm font-medium text-text-dim">{t($localeStore, 'home.gameLabel')}:</span>
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
					<label for="card-list" class="block text-sm font-medium text-text-dim">
						{t($localeStore, 'home.pasteList')}
					</label>
					<textarea
						id="card-list"
						bind:value={input}
						placeholder="4 Lightning Bolt (CLB) 785
4 Counterspell
2 Sol Ring
1 Thespian Stage"
						class="h-[500px] w-full resize-none rounded-xl border border-border bg-surface-raised p-4 font-mono text-sm leading-relaxed text-text placeholder-text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/50 focus:outline-none"
					></textarea>
					<div class="flex items-center justify-between gap-4">
						{#if !isSignedIn}
							<div class="flex-1">
								<input
									type="text"
									bind:value={ownerName}
									placeholder={t($localeStore, 'home.yourName')}
									class="w-full rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm text-text placeholder-text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/50 focus:outline-none"
								/>
							</div>
						{/if}
						<div class="flex items-center gap-4">
							<p class="text-sm text-text-muted">
								{parsedCards.length}
								{t($localeStore, 'home.uniqueCards')} · {totalCards}
								{t($localeStore, 'home.total')}
							</p>
							<button
								onclick={saveWishlist}
								disabled={!hasCards || isSaving}
								class="rounded-lg bg-accent-bg px-6 py-2 font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-hover"
							>
								{isSaving ? t($localeStore, 'home.saving') : t($localeStore, 'home.save')}
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
							>{t($localeStore, 'home.preview')}</span
						>
						<span class="text-xs text-text-muted">{t($localeStore, 'home.livePreview')}</span>
					</div>

					{#if isLoading}
						<div
							class="flex h-[500px] items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-raised/50"
						>
							<div class="text-center">
								<div
									class="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-border-strong border-t-emerald-500"
								></div>
								<p class="text-sm text-text-dim">{t($localeStore, 'home.fetching')}</p>
							</div>
						</div>
					{:else if lookupError}
						<div
							class="flex h-[500px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-surface-raised/50 p-6"
						>
							<p class="text-center text-sm text-danger">{lookupError}</p>
							<p class="text-center text-xs text-text-muted">
								{t($localeStore, 'home.imagesUnavailable')}
							</p>
						</div>
					{:else if hasCards}
						<div class="max-h-[500px] space-y-2 overflow-y-auto pr-2">
							{#each wishlistCards as card (card.name)}
								<CardRow {card} onClick={() => openCardEdit(card)} />
							{/each}
						</div>
					{:else}
						<div
							class="flex h-[500px] items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-raised/50"
						>
							<p class="text-sm text-text-muted">{t($localeStore, 'home.typeToPreview')}</p>
						</div>
					{/if}
				</div>
			</div>
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
