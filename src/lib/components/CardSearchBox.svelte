<script lang="ts">
	import type { WishlistCard } from '$lib/types';
	import type { TcgCard } from '$lib/api/providers/types';

	interface Props {
		gameSlug: string;
		placeholder?: string;
		onSelect: (card: WishlistCard) => void;
	}

	let { gameSlug, placeholder = 'Search a card by name…', onSelect }: Props = $props();

	let query = $state('');
	let results = $state<TcgCard[]>([]);
	let isSearching = $state(false);
	let isOpen = $state(false);
	let highlight = $state(-1);
	let searchError = $state<string | null>(null);

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	function debouncedSearch() {
		if (debounceTimer) clearTimeout(debounceTimer);
		const q = query.trim();
		if (q.length < 2) {
			results = [];
			isOpen = false;
			searchError = null;
			return;
		}
		debounceTimer = setTimeout(runSearch, 250);
	}

	async function runSearch() {
		const q = query.trim();
		if (q.length < 2) return;
		isSearching = true;
		searchError = null;
		try {
			const response = await fetch(
				`/api/cards/search?q=${encodeURIComponent(q)}&game=${encodeURIComponent(gameSlug)}&limit=8`
			);
			const result = await response.json();
			if (result.success && result.data?.cards) {
				results = result.data.cards;
				isOpen = results.length > 0;
				highlight = -1;
			} else {
				results = [];
				isOpen = false;
			}
		} catch {
			searchError = 'Search failed';
			results = [];
			isOpen = false;
		} finally {
			isSearching = false;
		}
	}

	function buildCard(c: TcgCard): WishlistCard {
		return {
			localId: crypto.randomUUID(),
			name: c.name,
			qty: 1,
			imageUrl: c.imageUrl,
			manaCost: c.manaCost,
			prices: c.prices,
			cardPrintingId: null,
			set: c.setCode,
			collectorNumber: c.collectorNumber,
			finish: c.finish || null,
			condition: 'NM',
			aftermarketSigned: false,
			isAltered: false,
			language: c.language || null,
			isTradeable: true
		};
	}

	function select(c: TcgCard) {
		onSelect(buildCard(c));
		query = '';
		results = [];
		isOpen = false;
		highlight = -1;
	}

	function onKeydown(e: KeyboardEvent) {
		if (!isOpen || results.length === 0) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlight = (highlight + 1) % results.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlight = (highlight - 1 + results.length) % results.length;
		} else if (e.key === 'Enter' && highlight >= 0) {
			e.preventDefault();
			select(results[highlight]);
		} else if (e.key === 'Escape') {
			isOpen = false;
		}
	}

	function formatPrice(p: string | null): string {
		return p ? `$${p}` : '—';
	}
</script>

<div class="relative">
	<div class="relative">
		<input
			type="text"
			bind:value={query}
			oninput={debouncedSearch}
			onkeydown={onKeydown}
			onfocus={() => results.length > 0 && (isOpen = true)}
			placeholder={placeholder}
			class="w-full rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm text-text placeholder-text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/50 focus:outline-none"
			autocomplete="off"
		/>
		{#if isSearching}
			<div
				class="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-border-strong border-t-emerald-500"
			></div>
		{/if}
	</div>

	{#if isOpen && results.length > 0}
		<ul
			class="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-border-strong bg-surface-raised shadow-xl"
		>
			{#each results as card, i (card.id)}
				<li>
					<button
						type="button"
						class="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors {highlight === i
							? 'bg-surface-card'
							: 'hover:bg-surface-card'}"
						onmouseenter={() => (highlight = i)}
						onclick={() => select(card)}
					>
						<div class="h-10 w-7 flex-shrink-0 overflow-hidden rounded bg-surface-card">
							{#if card.imageUrl}
								<img src={card.imageUrl} alt="" class="h-full w-full object-cover" loading="lazy" />
							{/if}
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium text-text">{card.name}</p>
							<p class="truncate text-xs text-text-muted">
								{card.setName || card.setCode}{card.collectorNumber
									? ` · #${card.collectorNumber}`
									: ''} · {card.finish}
							</p>
						</div>
						<div class="flex-shrink-0 text-xs text-accent">
							{formatPrice(card.prices?.usd)}
						</div>
					</button>
				</li>
			{/each}
		</ul>
	{:else if isOpen && query.trim().length >= 2 && !isSearching}
		<div
			class="absolute z-30 mt-1 w-full rounded-lg border border-border-strong bg-surface-raised px-3 py-3 text-sm text-text-muted shadow-xl"
		>
			No matches found
		</div>
	{/if}

	{#if searchError}
		<p class="mt-1 text-xs text-danger">{searchError}</p>
	{/if}
</div>
