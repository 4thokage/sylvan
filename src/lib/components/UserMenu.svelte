<script lang="ts">
	import { getAllContexts, mount, unmount } from 'svelte';
	import { get } from 'svelte/store';
	import { resolve } from '$app/paths';
	import { useClerkContext } from 'svelte-clerk';
	import { getLocaleStore, t } from '$lib/i18n';
	import { theme } from '$lib/stores/theme';
	import ClerkMount from './ClerkMount.svelte';
	import ProfileInfoPage from './ProfileInfoPage.svelte';
	import ProfileIcon from './icons/ProfileIcon.svelte';
	import InboxIcon from './icons/InboxIcon.svelte';

	let clerkCtx = useClerkContext();
	let localeStore = getLocaleStore();
	let contexts = getAllContexts();

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

	let user = $derived(clerkCtx.user);
	let isOpen = $state(false);
	let menuRef = $state<HTMLDivElement | null>(null);
	let profileApp: ReturnType<typeof mount> | null = null;

	let initials = $derived.by(() => {
		const u = user;
		if (!u) return '';
		const first = u.firstName?.[0] ?? '';
		const last = u.lastName?.[0] ?? '';
		if (first || last) return (first + last).toUpperCase();
		return (u.username?.[0] ?? u.primaryEmailAddress?.emailAddress?.[0] ?? '?').toUpperCase();
	});

	function close() {
		isOpen = false;
	}

	$effect(() => {
		if (!isOpen) return;
		function onPointerDown(event: PointerEvent) {
			if (menuRef && !menuRef.contains(event.target as Node)) {
				close();
			}
		}
		function onKeydown(event: KeyboardEvent) {
			if (event.key === 'Escape') close();
		}
		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeydown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeydown);
		};
	});

	function openAccount() {
		close();
		clerkCtx.clerk?.openUserProfile({
			appearance: clerkAppearance,
			customPages: [
				{
					url: 'custom',
					label: t(get(localeStore), 'profile.bio'),
					mount(el) {
						profileApp = mount(ClerkMount, {
							target: el,
							props: { children: profilePageSnippet },
							context: contexts
						});
					},
					unmount() {
						if (profileApp) {
							unmount(profileApp);
							profileApp = null;
						}
					}
				}
			]
		});
	}

	function signOut() {
		close();
		clerkCtx.clerk?.signOut({ redirectUrl: resolve('/') });
	}
</script>

{#snippet profilePageSnippet()}
	<ProfileInfoPage />
{/snippet}

{#if user}
	<div class="relative" bind:this={menuRef}>
		<button
			type="button"
			onclick={() => (isOpen = !isOpen)}
			aria-expanded={isOpen}
			aria-haspopup="menu"
			class="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border-strong bg-surface-card text-xs font-semibold text-text transition-colors hover:border-accent/60"
		>
			{#if user.imageUrl}
				<img src={user.imageUrl} alt="" class="h-full w-full object-cover" />
			{:else}
				{initials}
			{/if}
		</button>

		{#if isOpen}
			<div
				role="menu"
				class="absolute top-full right-0 z-50 mt-2 w-64 rounded-lg border border-border-strong bg-surface-raised py-1 shadow-xl"
			>
				<div class="border-b border-border px-4 py-3">
					<p class="truncate text-sm font-medium text-text">
						{user.fullName || user.username || user.primaryEmailAddress?.emailAddress || 'User'}
					</p>
					{#if user.primaryEmailAddress?.emailAddress}
						<p class="truncate text-xs text-text-muted">{user.primaryEmailAddress.emailAddress}</p>
					{/if}
				</div>

				<a
					href={resolve(`/users/${user.id}`)}
					role="menuitem"
					onclick={close}
					class="flex items-center gap-3 px-4 py-2 text-sm text-text-dim transition-colors hover:bg-surface-card hover:text-text"
				>
					<ProfileIcon />
					{t($localeStore, 'nav.profile')}
				</a>

				<a
					href={resolve('/inbox')}
					role="menuitem"
					onclick={close}
					class="flex items-center gap-3 px-4 py-2 text-sm text-text-dim transition-colors hover:bg-surface-card hover:text-text"
				>
					<InboxIcon />
					{t($localeStore, 'nav.inbox')}
				</a>

				<button
					type="button"
					role="menuitem"
					onclick={openAccount}
					class="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-text-dim transition-colors hover:bg-surface-card hover:text-text"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z"
						/>
					</svg>
					{t($localeStore, 'nav.manageAccount')}
				</button>

				<button
					type="button"
					role="menuitem"
					onclick={signOut}
					class="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-danger transition-colors hover:bg-surface-card"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
						/>
					</svg>
					{t($localeStore, 'nav.signOut')}
				</button>
			</div>
		{/if}
	</div>
{/if}
