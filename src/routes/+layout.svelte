<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { resolve } from '$app/paths';
	import { ClerkProvider } from 'svelte-clerk';
	import HeaderNav from '$lib/components/HeaderNav.svelte';
	import { createLocaleStore, setLocaleContext, t } from '$lib/i18n';

	let { children, data } = $props();

	let locale = $state<'en' | 'pt'>('en');
	let localeStore = createLocaleStore();
	setLocaleContext(localeStore);

	$effect(() => {
		const unsub = localeStore.subscribe((l) => (locale = l));
		return unsub;
	});

	let __t = $derived((path: string) => t(locale, path));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta
		name="description"
		content="Multi-TCG trading platform. Trade Magic: The Gathering, Pokémon TCG, and Riftbound cards."
	/>
	<meta name="theme-color" content="#10b981" />
	<meta name="application-name" content="Sylvan" />
	<meta property="og:title" content="Sylvan" />
	<meta
		property="og:description"
		content="Multi-TCG trading platform. Trade MTG, Pokémon TCG, and Riftbound cards."
	/>
	<meta property="og:type" content="website" />
</svelte:head>

<ClerkProvider>
	<div class="min-h-screen bg-surface text-text">
		<header class="border-b border-border px-4 py-3 sm:px-6 sm:py-4">
			<div class="mx-auto flex max-w-7xl items-center justify-between">
				<a href={resolve('/')} class="text-xl font-semibold tracking-tight text-accent sm:text-2xl">
					Sylvan
				</a>

				<HeaderNav {data} />
			</div>
		</header>

		<main class="pb-20 sm:pb-0">
			{@render children()}
		</main>

		<footer class="hidden border-t border-border px-6 py-4 sm:block">
			<div class="mx-auto max-w-7xl">
				<div class="flex items-center justify-center gap-4 text-sm text-text-dim">
					<a href={resolve('/terms')} class="hover:text-text" data-sveltekit-preload-data
						>{__t('terms')}</a
					>
					<span class="text-text-muted">•</span>
					<a href={resolve('/privacy')} class="hover:text-text" data-sveltekit-preload-data
						>{__t('privacy')}</a
					>
				</div>
			</div>
		</footer>
	</div>
</ClerkProvider>
