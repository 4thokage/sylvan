<script lang="ts">
	import { parseCardList } from '$lib/parser';
	import type { WishlistCard, CardPrint, LookupResult } from '$lib/types';
	import { getCreatorFingerprint } from '$lib/device';
	import { getLocaleStore, t } from '$lib/i18n';
	import PrintingsDropdown from '$lib/components/PrintingsDropdown.svelte';

	let localeStore = getLocaleStore();
	let input = $state('');
	let ownerName = $state('');
	let selectedGame = $state('mtg');
	let isSaving = $state(false);
	let savedId = $state<string | null>(null);
	let error = $state<string | null>(null);
	let wishlistCards = $state<WishlistCard[]>([]);
	let isLoading = $state(false);
	let lookupError = $state<string | null>(null);
	let openPrintingsForCard = $state<string | null>(null);

	const parsedCards = $derived(parseCardList(input));
	const hasCards = $derived(parsedCards.length > 0);
	const totalCards = $derived(parsedCards.reduce((sum, c) => sum + c.qty, 0));

	const games = [
		{ id: 'mtg', name: 'Magic: The Gathering' },
		{ id: 'pokemon', name: 'Pokémon TCG' },
		{ id: 'riftbound', name: 'Riftbound' }
	];

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

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
						cards: cards.map((c) => ({ name: c.name, qty: c.qty })),
						game: selectedGame
					})
				});
				const result = await response.json();
				if (result.success && result.data?.cards) {
					wishlistCards = result.data.cards.map((c: LookupResult) => ({
						name: c.name,
						qty: c.qty,
						imageUrl: c.imageUrl,
						manaCost: c.manaCost,
						prices: c.prices as WishlistCard['prices']
					}));
				} else {
					lookupError = result.error?.message ?? 'Failed to fetch cards';
					wishlistCards = cards.map((c) => ({ name: c.name, qty: c.qty, imageUrl: null, manaCost: null }));
				}
			} catch {
				lookupError = 'Failed to fetch cards';
				wishlistCards = cards.map((c) => ({ name: c.name, qty: c.qty, imageUrl: null, manaCost: null }));
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
						imageUrl: c.imageUrl,
						manaCost: c.manaCost,
						oracleId: c.oracleId
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

	function handlePrintSelect(cardName: string, print: CardPrint, index: number) {
		wishlistCards = wishlistCards.map((card) => {
			if (card.name === cardName) {
				return {
					...card,
					imageUrl: print.imageUrl,
					manaCost: print.manaCost,
					prices: {
						usd: print.price,
						usdFoil: print.priceFoil,
						eur: null,
						eurFoil: null,
						tix: null
					},
					selectedPrintIndex: index
				};
			}
			return card;
		});
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
					onclick={() => { savedId = null; input = ''; }}
					class="text-text-dim underline hover:text-text"
				>
					{t($localeStore, 'home.createAnother')}
				</button>
			</div>
		{:else}
			<div class="mb-6 flex items-center gap-4">
				<span class="text-sm font-medium text-text-dim">{t($localeStore, 'home.gameLabel')}:</span>
				<div class="flex gap-2">
					{#each games as game}
						<button
							onclick={() => selectedGame = game.id}
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
						<div class="flex-1">
							<input
								type="text"
								bind:value={ownerName}
								placeholder="Your name (optional)"
								class="w-full rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm text-text placeholder-text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/50 focus:outline-none"
							/>
						</div>
						<div class="flex items-center gap-4">
							<p class="text-sm text-text-muted">
								{parsedCards.length} {t($localeStore, 'home.uniqueCards')} · {totalCards} {t($localeStore, 'home.total')}
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
						<span class="block text-sm font-medium text-text-dim">{t($localeStore, 'home.preview')}</span>
						<span class="text-xs text-text-muted">{t($localeStore, 'home.livePreview')}</span>
					</div>

					{#if isLoading}
						<div class="flex h-[500px] items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-raised/50">
							<div class="text-center">
								<div class="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-border-strong border-t-emerald-500"></div>
								<p class="text-sm text-text-dim">{t($localeStore, 'home.fetching')}</p>
							</div>
						</div>
					{:else if lookupError}
						<div class="flex h-[500px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-surface-raised/50 p-6">
							<p class="text-center text-sm text-danger">{lookupError}</p>
							<p class="text-center text-xs text-text-muted">{t($localeStore, 'home.imagesUnavailable')}</p>
						</div>
					{:else if hasCards}
						<div class="grid max-h-[500px] grid-cols-2 gap-4 overflow-y-auto pr-2 sm:grid-cols-3">
							{#each wishlistCards as card (card.name)}
								{@const cardId = `card-${card.name.replace(/[^a-zA-Z0-9]/g, '-')}`}
								<div class="group relative overflow-hidden rounded-lg border border-border bg-surface-raised transition-all hover:scale-[1.02] hover:border-border-strong">
									{#if card.imageUrl}
										<img src={card.imageUrl} alt={card.name} class="aspect-[5/7] w-full object-cover" loading="lazy" />
									{:else}
										<div class="flex aspect-[5/7] w-full items-center justify-center bg-surface-card">
											<span class="px-2 text-center text-xs text-text-muted">{card.name}</span>
										</div>
									{/if}
									<div class="absolute top-2 right-2 rounded bg-surface/90 px-2 py-0.5 text-xs font-bold text-text">×{card.qty}</div>
									{#if card.selectedPrintIndex !== undefined}
										<div class="absolute bottom-14 left-2 rounded bg-emerald-900/80 px-2 py-0.5 text-[10px] text-emerald-300">
											{(card.printings?.[card.selectedPrintIndex]?.set ?? '').toUpperCase()}
										</div>
									{/if}
									<div class="border-t border-border p-2">
										<div class="flex items-center justify-between">
											<p class="truncate text-xs text-text-soft">{card.name}</p>
											<button
												type="button"
												class="edit-btn text-text-muted hover:text-text-soft"
												data-card-id={cardId}
												aria-label="Edit printing"
												onclick={() => (openPrintingsForCard = openPrintingsForCard === card.name ? null : card.name)}
											>
												<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
												</svg>
											</button>
										</div>
										{#if card.manaCost}
											<p class="mt-0.5 text-xs text-text-muted">{card.manaCost}</p>
										{/if}
									</div>
								</div>
							{/each}
						</div>
						{#each wishlistCards as card (card.name)}
							{@const cardId = `card-${card.name.replace(/[^a-zA-Z0-9]/g, '-')}`}
							{@const positionRef = typeof document !== 'undefined' ? document.querySelector(`[data-card-id="${cardId}"]`) : null}
							{#if openPrintingsForCard === card.name}
								<PrintingsDropdown
									{card}
									positionRef={positionRef as HTMLElement}
									onSelect={(print, index) => { handlePrintSelect(card.name, print, index); openPrintingsForCard = null; }}
									isOpen={true}
									gameSlug={selectedGame}
								/>
							{/if}
						{/each}
					{:else}
						<div class="flex h-[500px] items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-raised/50">
							<p class="text-sm text-text-muted">{t($localeStore, 'home.typeToPreview')}</p>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</main>
</div>
