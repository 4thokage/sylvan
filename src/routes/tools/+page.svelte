<script lang="ts">
	import { getLocaleStore, t } from '$lib/i18n';
	import { resolve } from '$app/paths';

	let localeStore = getLocaleStore();

	const tools = [
		{
			id: 'scan',
			color: 'bg-blue-500/10 text-blue-400'
		},
		{
			id: 'value',
			color: 'bg-emerald-500/10 text-emerald-400'
		},
		{
			id: 'fairness',
			color: 'bg-amber-500/10 text-amber-400'
		},
		{
			id: 'life',
			color: 'bg-rose-500/10 text-rose-400'
		}
	];
</script>

<svelte:head>
	<title>Sylvan - {t($localeStore, 'tools.title')}</title>
	<meta name="description" content="Trading tools for TCG collectors" />
</svelte:head>

<div class="min-h-screen bg-surface text-text">
	<header class="border-b border-border px-6 py-4">
		<h1 class="text-xl font-semibold">{t($localeStore, 'tools.title')}</h1>
		<p class="mt-1 text-sm text-text-muted">{t($localeStore, 'tools.subtitle')}</p>
	</header>

	<main class="mx-auto max-w-4xl p-6">
		<div class="grid gap-6 sm:grid-cols-2">
			{#each tools as tool (tool.id)}
				<!-- svelte-ignore a11y_no_redundant_roles -->
				<a
					href={resolve(`/tools/${tool.id}`)}
					class="group flex items-start gap-4 rounded-xl border border-border bg-surface-raised p-6 transition-colors hover:border-border-strong"
					role="link"
				>
					<div class="flex-shrink-0 rounded-lg p-3 {tool.color}">
						{#if tool.id === 'scan'}
							<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M3 7V5a2 2 0 012-2h2m0 14H5a2 2 0 01-2-2v-2m14 2h2a2 2 0 002-2v-2M7 3h10M3 17v2a2 2 0 002 2h2m10-2h2a2 2 0 002-2v-2"
								/>
							</svg>
						{:else if tool.id === 'value'}
							<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
						{:else if tool.id === 'fairness'}
							<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
								/>
							</svg>
						{:else}
							<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
								/>
							</svg>
						{/if}
					</div>
					<div>
						<h3 class="font-medium text-text group-hover:text-accent">
							{t($localeStore, `tools.${tool.id}.title`)}
						</h3>
						<p class="mt-1 text-sm text-text-muted">
							{t($localeStore, `tools.${tool.id}.description`)}
						</p>
					</div>
				</a>
			{/each}
		</div>
	</main>
</div>
