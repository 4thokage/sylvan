<script lang="ts">
	import { useClerkContext, SignInButton, UserButton } from 'svelte-clerk';
	import { resolve } from '$app/paths';
	import ThemeToggle from './ThemeToggle.svelte';
	import LocaleToggle from './LocaleToggle.svelte';
	import NotificationBell from './NotificationBell.svelte';
	import { getLocaleStore, t } from '$lib/i18n';
	import ProfileInfoPage from './ProfileInfoPage.svelte';
	import InboxIcon from './icons/InboxIcon.svelte';
	import ProfileIcon from './icons/ProfileIcon.svelte';
	import { theme } from '$lib/stores/theme';

	let { data }: { data: { user?: { is_admin?: boolean | null } | null } } = $props();

	let clerkCtx = useClerkContext();
	let isSignedIn = $derived(!!clerkCtx.user || !!data.user);
	let isAdmin = $derived(data.user?.is_admin ?? false);
	let localeStore = getLocaleStore();
	let isToolsOpen = $state(false);
	let toolsTimer: ReturnType<typeof setTimeout> | null = null;

	let isDark = $derived(
		$theme === 'dark' ||
			($theme === 'system' &&
				typeof window !== 'undefined' &&
				window.matchMedia('(prefers-color-scheme: dark)').matches)
	);

	let clerkAppearance = $derived({
		baseTheme: isDark ? 'dark' : undefined,
		variables: {
			colorPrimary: isDark ? '#34d399' : '#059669',
			colorBackground: isDark ? '#18181b' : '#ffffff',
			colorText: isDark ? '#f4f4f5' : '#18181b',
			colorTextSecondary: isDark ? '#a1a1aa' : '#71717a',
			colorInputBackground: isDark ? '#27272a' : '#f4f4f5',
			colorInputText: isDark ? '#f4f4f5' : '#18181b',
			colorDanger: isDark ? '#f87171' : '#dc2626',
			colorSuccess: isDark ? '#34d399' : '#059669',
			borderRadius: '0.5rem',
			fontFamily: 'inherit'
		}
	});

	function openTools() {
		if (toolsTimer) clearTimeout(toolsTimer);
		isToolsOpen = true;
	}

	function closeTools() {
		toolsTimer = setTimeout(() => {
			isToolsOpen = false;
		}, 150);
	}
</script>

<nav class="hidden items-center gap-4 sm:flex" aria-label="Main navigation">
	<a href={resolve('/')} class="text-sm text-text-dim hover:text-text" data-sveltekit-preload-data>
		{t($localeStore, 'nav.wants')}
	</a>
	<a
		href={resolve('/collection')}
		class="text-sm text-text-dim hover:text-text"
		data-sveltekit-preload-data
	>
		{t($localeStore, 'nav.haves')}
	</a>
	<a
		href={resolve('/trades')}
		class="text-sm text-text-dim hover:text-text"
		data-sveltekit-preload-data
	>
		{t($localeStore, 'nav.trades')}
	</a>
	<div class="relative" onmouseenter={openTools} onmouseleave={closeTools} role="none">
		<button class="text-sm text-text-dim hover:text-text flex items-center gap-1">
			{t($localeStore, 'nav.tools')}
			<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
			</svg>
		</button>
		{#if isToolsOpen}
			<div
				class="absolute top-full left-0 mt-1 w-56 rounded-lg border border-border bg-surface-raised py-2 shadow-xl"
			>
				<a
					href={resolve('/tools/value')}
					class="flex items-center gap-3 px-4 py-2 text-sm text-text-dim hover:bg-surface-card hover:text-text"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					{t($localeStore, 'tools.value.title')}
				</a>
				<a
					href={resolve('/tools/fairness')}
					class="flex items-center gap-3 px-4 py-2 text-sm text-text-dim hover:bg-surface-card hover:text-text"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
						/>
					</svg>
					{t($localeStore, 'tools.fairness.title')}
				</a>
			</div>
		{/if}
	</div>
	{#if isAdmin}
		<a
			href={resolve('/admin')}
			class="text-sm text-amber-400 hover:text-amber-300"
			data-sveltekit-preload-data
		>
			Admin
		</a>
	{/if}
</nav>

<div class="flex items-center gap-2 sm:gap-3">
	<LocaleToggle />
	<ThemeToggle />
	{#if isSignedIn}
		<NotificationBell />
		<UserButton appearance={clerkAppearance}>
			<UserButton.MenuItems>
				<UserButton.Link
					label={t($localeStore, 'nav.inbox')}
					href={resolve('/inbox')}
					labelIcon={InboxIcon}
				/>
				<UserButton.Action label="manageAccount" />
				<UserButton.Action label="signOut" />
			</UserButton.MenuItems>
			<UserButton.UserProfilePage
				label={t($localeStore, 'profile.bio')}
				url="custom"
				labelIcon={ProfileIcon}
			>
				<ProfileInfoPage />
			</UserButton.UserProfilePage>
		</UserButton>
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
		<a
			href={resolve('/')}
			class="flex flex-col items-center gap-0.5 px-3 text-text-dim hover:text-text"
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 6v6m0 0v6m0-6h6m-6 0H6"
				/>
			</svg>
			<span class="text-[10px]">{t($localeStore, 'nav.wants')}</span>
		</a>
		<a
			href={resolve('/collection')}
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
			<span class="text-[10px]">{t($localeStore, 'nav.haves')}</span>
		</a>
		<a
			href={resolve('/trades')}
			class="flex flex-col items-center gap-0.5 px-3 text-text-dim hover:text-text"
		>
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
		<a
			href={resolve('/tools')}
			class="flex flex-col items-center gap-0.5 px-3 text-text-dim hover:text-text"
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
				/>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
				/>
			</svg>
			<span class="text-[10px]">{t($localeStore, 'nav.tools')}</span>
		</a>
		{#if isSignedIn}
			<a
				href={resolve('/inbox')}
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
