<script lang="ts">
	import { parseCardList } from '$lib/parser';
	import type { LookupResult } from '$lib/types';
	import { getLocaleStore, t } from '$lib/i18n';

	let localeStore = getLocaleStore();
	let input = $state('');
	let isLoading = $state(false);
	let results = $state<LookupResult[]>([]);

	const parsed = $derived(parseCardList(input));
	const totalValue = $derived(results.reduce((sum, c) => sum + (c.prices?.usd || 0) * c.qty, 0));
	const topCards = $derived(
		[...results]
			.sort((a, b) => (b.prices?.usd || 0) * b.qty - (a.prices?.usd || 0) * a.qty)
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
								<span class="text-accent">${((card.prices?.usd || 0) * card.qty).toFixed(2)}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
