<script lang="ts">
	import { parseCardList } from '$lib/parser';
	import type { LookupResult } from '$lib/types';
	import { getLocaleStore, t } from '$lib/i18n';

	let localeStore = getLocaleStore();
	let sideA = $state('');
	let sideB = $state('');
	let resultsA = $state<LookupResult[]>([]);
	let resultsB = $state<LookupResult[]>([]);
	let isLoading = $state(false);

	const parsedA = $derived(parseCardList(sideA));
	const parsedB = $derived(parseCardList(sideB));

	const totalA = $derived(resultsA.reduce((sum, c) => sum + (c.prices?.usd || 0) * c.qty, 0));
	const totalB = $derived(resultsB.reduce((sum, c) => sum + (c.prices?.usd || 0) * c.qty, 0));
	const difference = $derived(Math.abs(totalA - totalB));
	const fairness = $derived(() => {
		const max = Math.max(totalA, totalB);
		if (max === 0) return 100;
		const ratio = Math.min(totalA, totalB) / max;
		return Math.round(ratio * 100);
	});

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	async function lookup(cards: ReturnType<typeof parseCardList>) {
		if (cards.length === 0) return [];
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
		if (result.success && result.data?.cards) return result.data.cards as LookupResult[];
		return [];
	}

	$effect(() => {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(async () => {
			isLoading = true;
			const [a, b] = await Promise.all([lookup(parsedA), lookup(parsedB)]);
			resultsA = a;
			resultsB = b;
			isLoading = false;
		}, 800);
	});
</script>

<svelte:head>
	<title>Sylvan - {t($localeStore, 'tools.fairness.title')}</title>
</svelte:head>

<div class="mx-auto max-w-4xl p-6">
	<h1 class="mb-2 text-2xl font-semibold">{t($localeStore, 'tools.fairness.title')}</h1>
	<p class="mb-6 text-text-muted">{t($localeStore, 'tools.fairness.description')}</p>

	<div class="grid gap-6 lg:grid-cols-2">
		<div class="space-y-2">
			<label class="text-sm font-medium text-text-dim"
				>{t($localeStore, 'tools.fairness.sideA')}</label
			>
			<textarea
				bind:value={sideA}
				placeholder="4 Lightning Bolt&#10;1 Black Lotus"
				class="h-[250px] w-full resize-none rounded-xl border border-border bg-surface-raised p-4 font-mono text-sm leading-relaxed text-text placeholder-text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/50 focus:outline-none"
			></textarea>
			<p class="text-sm text-text-muted">
				{t($localeStore, 'tools.fairness.totalA')}: ${totalA.toFixed(2)}
			</p>
		</div>

		<div class="space-y-2">
			<label class="text-sm font-medium text-text-dim"
				>{t($localeStore, 'tools.fairness.sideB')}</label
			>
			<textarea
				bind:value={sideB}
				placeholder="4 Counterspell&#10;1 Mox Pearl"
				class="h-[250px] w-full resize-none rounded-xl border border-border bg-surface-raised p-4 font-mono text-sm leading-relaxed text-text placeholder-text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/50 focus:outline-none"
			></textarea>
			<p class="text-sm text-text-muted">
				{t($localeStore, 'tools.fairness.totalB')}: ${totalB.toFixed(2)}
			</p>
		</div>
	</div>

	{#if isLoading}
		<div class="mt-6 flex items-center gap-2 text-sm text-text-muted">
			<div
				class="h-4 w-4 animate-spin rounded-full border-2 border-border-strong border-t-emerald-500"
			></div>
			{t($localeStore, 'common.loading')}
		</div>
	{:else if (resultsA.length > 0 || resultsB.length > 0) && (totalA > 0 || totalB > 0)}
		<div class="mt-6 rounded-xl border border-border bg-surface-raised p-6">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm text-text-muted">{t($localeStore, 'tools.fairness.difference')}</p>
					<p class="text-xl font-semibold text-text">${difference.toFixed(2)}</p>
				</div>
				<div class="text-right">
					<p class="text-sm text-text-muted">{t($localeStore, 'tools.fairness.fairnessScore')}</p>
					<p
						class="text-3xl font-bold {fairness() >= 90
							? 'text-accent'
							: fairness() >= 70
								? 'text-amber-400'
								: 'text-danger'}"
					>
						{fairness()}%
					</p>
					<p class="text-sm text-text-muted">
						{#if fairness() >= 90}
							{t($localeStore, 'tools.fairness.balanced')}
						{:else if totalA > totalB}
							{t($localeStore, 'tools.fairness.favorsA')}
						{:else}
							{t($localeStore, 'tools.fairness.favorsB')}
						{/if}
					</p>
				</div>
			</div>
		</div>
	{/if}
</div>
