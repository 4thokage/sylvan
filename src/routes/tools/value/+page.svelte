<script lang="ts">
	import { parseCardList } from '$lib/parser';
	import type { LookupResult } from '$lib/types';
	import { getLocaleStore, t } from '$lib/i18n';

	let { data } = $props();

	let localeStore = getLocaleStore();
	let input = $state('');
	let isLoading = $state(false);
	let results = $state<LookupResult[]>([]);

	const gameNames: Record<string, string> = {
		mtg: 'Magic: The Gathering',
		pokemon: 'Pokémon TCG',
		riftbound: 'Riftbound'
	};

	// When the user is signed in and owns one or more haves lists, surface the
	// value of those lists by default instead of requiring a pasted collection.
	let useHaves = $state(data.signedIn && data.lists.length > 0);

	const havesCards = $derived(
		data.lists.flatMap((l) => l.cards.map((c) => ({ ...c, game: l.game })))
	);
	const havesTotalUsd = $derived(
		havesCards.reduce(
			(sum, c) => sum + (parseFloat(c.marketPriceUsd?.toString() || '0') || 0) * c.qty,
			0
		)
	);
	const havesTopCards = $derived(
		[...havesCards]
			.sort(
				(a, b) =>
					(parseFloat(b.marketPriceUsd?.toString() || '0') || 0) * b.qty -
					(parseFloat(a.marketPriceUsd?.toString() || '0') || 0) * a.qty
			)
			.slice(0, 10)
	);
	const havesGameTotals = $derived(
		data.lists.map((l) => ({
			game: l.game,
			total: l.cards.reduce(
				(sum, c) => sum + (parseFloat(c.marketPriceUsd?.toString() || '0') || 0) * c.qty,
				0
			),
			unique: l.cards.length,
			totalCards: l.cards.reduce((sum, c) => sum + c.qty, 0)
		}))
	);

	const parsed = $derived(parseCardList(input));
	const totalValue = $derived(
		results.reduce((sum, c) => sum + parseFloat(c.prices?.usd || '0') * c.qty, 0)
	);
	const topCards = $derived(
		[...results]
			.sort(
				(a, b) =>
					parseFloat(b.prices?.usd || '0') * b.qty - parseFloat(a.prices?.usd || '0') * a.qty
			)
			.slice(0, 10)
	);

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		const cards = parsed;
		if (debounceTimer) clearTimeout(debounceTimer);
		if (cards.length === 0) {
			results = [];
			return;
		}
		isLoading = true;
		debounceTimer = setTimeout(async () => {
			try {
				const res = await fetch('/api/cards/lookup', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						cards: cards.map((c) => ({
							name: c.name,
							qty: c.qty,
							set: c.set,
							collector_number: c.collector_number
						})),
						game: 'mtg'
					})
				});
				const result = await res.json();
				if (result.success && result.data?.cards) {
					results = result.data.cards;
				}
			} catch {
				// lookup failed silently
			} finally {
				isLoading = false;
			}
		}, 800);
	});
</script>

<svelte:head>
	<title>Sylvan - {t($localeStore, 'tools.value.title')}</title>
</svelte:head>

<div class="mx-auto max-w-4xl p-6">
	<h1 class="mb-2 text-2xl font-semibold">{t($localeStore, 'tools.value.title')}</h1>
	<p class="mb-6 text-text-muted">{t($localeStore, 'tools.value.description')}</p>

	{#if data.signedIn && data.lists.length > 0}
		<div class="mb-6 flex items-center justify-end">
			<button
				onclick={() => (useHaves = !useHaves)}
				class="rounded-lg border border-border-strong px-3 py-2 text-sm text-text-soft transition-colors hover:bg-surface-card"
			>
				{useHaves
					? t($localeStore, 'tools.value.valueCustomList')
					: t($localeStore, 'tools.value.useMyHaves')}
			</button>
		</div>
	{/if}

	{#if useHaves && data.lists.length > 0}
		<div class="mt-2 grid gap-6 lg:grid-cols-2">
			<div class="rounded-xl border border-border bg-surface-raised p-6">
				<p class="text-sm text-text-muted">{t($localeStore, 'tools.value.totalValue')}</p>
				<p class="mt-1 text-3xl font-bold text-accent">${havesTotalUsd.toFixed(2)}</p>
				<p class="mt-1 text-sm text-text-muted">
					{havesCards.length}
					{t($localeStore, 'haves.unique')} · {havesCards.reduce((s, c) => s + c.qty, 0)}
					{t($localeStore, 'haves.total')}
				</p>
			</div>

			<div class="rounded-xl border border-border bg-surface-raised p-6">
				<p class="text-sm font-medium text-text-dim mb-3">
					{t($localeStore, 'tools.value.topCards')}
				</p>
				{#if havesTopCards.length === 0}
					<p class="text-sm text-text-muted">{t($localeStore, 'tools.value.noPrices')}</p>
				{:else}
					<div class="space-y-2">
						{#each havesTopCards as card (card.name + '-' + card.game)}
							<div class="flex items-center justify-between text-sm">
								<span class="text-text">{card.qty}x {card.name}</span>
								<span class="text-accent"
									>${((parseFloat(card.marketPriceUsd?.toString() || '0') || 0) * card.qty).toFixed(
										2
									)}</span
								>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<div class="mt-6">
			<p class="mb-3 text-sm font-medium text-text-dim">{t($localeStore, 'tools.value.byGame')}</p>
			<div class="space-y-2">
				{#each havesGameTotals as row (row.game)}
					<div
						class="flex items-center justify-between rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm"
					>
						<span class="text-text">{gameNames[row.game] || row.game}</span>
						<span class="text-text-muted"
							>{row.unique}
							{t($localeStore, 'haves.unique')} · {row.totalCards}
							{t($localeStore, 'haves.total')} ·
							<span class="text-accent">${row.total.toFixed(2)}</span></span
						>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<label for="value-input" class="block text-sm font-medium text-text-dim mb-2">
			{t($localeStore, 'tools.value.inputLabel')}
		</label>
		<textarea
			id="value-input"
			bind:value={input}
			placeholder="4 Lightning Bolt&#10;1 Black Lotus"
			class="h-[250px] w-full resize-none rounded-xl border border-border bg-surface-raised p-4 font-mono text-sm leading-relaxed text-text placeholder-text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/50 focus:outline-none"
		></textarea>

		{#if isLoading}
			<div class="mt-4 flex items-center gap-2 text-sm text-text-muted">
				<div
					class="h-4 w-4 animate-spin rounded-full border-2 border-border-strong border-t-emerald-500"
				></div>
				{t($localeStore, 'common.loading')}
			</div>
		{:else if results.length > 0}
			<div class="mt-6 grid gap-6 lg:grid-cols-2">
				<div class="rounded-xl border border-border bg-surface-raised p-6">
					<p class="text-sm text-text-muted">{t($localeStore, 'tools.value.totalValue')}</p>
					<p class="mt-1 text-3xl font-bold text-accent">${totalValue.toFixed(2)}</p>
					<p class="mt-1 text-sm text-text-muted">
						{results.length}
						{t($localeStore, 'haves.unique')} · {results.reduce((s, c) => s + c.qty, 0)}
						{t($localeStore, 'haves.total')}
					</p>
				</div>

				<div class="rounded-xl border border-border bg-surface-raised p-6">
					<p class="text-sm font-medium text-text-dim mb-3">
						{t($localeStore, 'tools.value.topCards')}
					</p>
					{#if topCards.length === 0}
						<p class="text-sm text-text-muted">{t($localeStore, 'tools.value.noPrices')}</p>
					{:else}
						<div class="space-y-2">
							{#each topCards as card (card.cardPrintingId || card.name + '-' + (card.set || ''))}
								<div class="flex items-center justify-between text-sm">
									<span class="text-text">{card.qty}x {card.name}</span>
									<span class="text-accent"
										>${(parseFloat(card.prices?.usd || '0') * card.qty).toFixed(2)}</span
									>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{:else if data.signedIn && data.lists.length === 0}
			<p class="mt-4 text-sm text-text-muted">{t($localeStore, 'tools.value.noHaves')}</p>
		{/if}
	{/if}
</div>
