<script lang="ts">
	import { useClerkContext, SignInButton, UserButton } from 'svelte-clerk';
	import ThemeToggle from './ThemeToggle.svelte';
	import LocaleToggle from './LocaleToggle.svelte';
	import { getLocaleStore, t } from '$lib/i18n';

	let { data }: { data: { user?: { is_admin?: boolean } | null } } = $props();

	let clerkCtx = useClerkContext();
	let isSignedIn = $derived(!!clerkCtx.user || !!data.user);
	let isAdmin = $derived(data.user?.is_admin ?? false);
	let localeStore = getLocaleStore();
</script>

<nav class="hidden items-center gap-4 sm:flex" aria-label="Main navigation">
	<a href="/" class="text-sm text-text-dim hover:text-text" data-sveltekit-preload-data
		>{t($localeStore, 'nav.create')}</a
	>
	<a href="/scan" class="text-sm text-text-dim hover:text-text" data-sveltekit-preload-data
		>{t($localeStore, 'nav.scan')}</a
	>
	<a href="/collection" class="text-sm text-text-dim hover:text-text" data-sveltekit-preload-data
		>{t($localeStore, 'nav.collection')}</a
	>
	<a href="/trades" class="text-sm text-text-dim hover:text-text" data-sveltekit-preload-data
		>{t($localeStore, 'nav.trades')}</a
	>
	{#if isAdmin}
		<a href="/admin" class="text-sm text-amber-400 hover:text-amber-300" data-sveltekit-preload-data
			>Admin</a
		>
	{/if}
</nav>

<div class="flex items-center gap-2 sm:gap-3">
	<LocaleToggle />
	<ThemeToggle />
	{#if isSignedIn}
		<a
			href="/inbox"
			class="text-sm text-text-dim hover:text-text"
			data-sveltekit-preload-data
			aria-label="Inbox"
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414a1 1 0 00-.707-.293H4"
				/>
			</svg>
		</a>
		<UserButton />
	{:else}
		<SignInButton
			forceRedirectUrl="/trades"
			class="rounded-lg bg-accent-bg px-3 py-1.5 text-sm text-white transition-colors hover:bg-accent-hover sm:px-4"
		>
			{t($localeStore, 'nav.signIn')}
		</SignInButton>
	{/if}
</div>

<nav
	class="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface sm:hidden"
	aria-label="Mobile navigation"
>
	<div class="flex items-center justify-around py-2">
		<a href="/" class="flex flex-col items-center gap-0.5 px-3 text-text-dim hover:text-text">
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 6v6m0 0v6m0-6h6m-6 0H6"
				/>
			</svg>
			<span class="text-[10px]">{t($localeStore, 'nav.create')}</span>
		</a>
		<a href="/scan" class="flex flex-col items-center gap-0.5 px-3 text-text-dim hover:text-text">
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M3 7V5a2 2 0 012-2h2m0 14H5a2 2 0 01-2-2v-2m14 2h2a2 2 0 002-2v-2M7 3h10M3 17v2a2 2 0 002 2h2m10-2h2a2 2 0 002-2v-2"
				/>
			</svg>
			<span class="text-[10px]">{t($localeStore, 'nav.scan')}</span>
		</a>
		<a
			href="/collection"
			class="flex flex-col items-center gap-0.5 px-3 text-text-dim hover:text-text"
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
				/>
			</svg>
			<span class="text-[10px]">{t($localeStore, 'nav.collection')}</span>
		</a>
		<a href="/trades" class="flex flex-col items-center gap-0.5 px-3 text-text-dim hover:text-text">
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
				/>
			</svg>
			<span class="text-[10px]">{t($localeStore, 'nav.trades')}</span>
		</a>
		{#if isSignedIn}
			<a
				href="/inbox"
				class="flex flex-col items-center gap-0.5 px-3 text-text-dim hover:text-text"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414a1 1 0 00-.707-.293H4"
					/>
				</svg>
				<span class="text-[10px]">{t($localeStore, 'nav.inbox')}</span>
			</a>
		{/if}
	</div>
</nav>
