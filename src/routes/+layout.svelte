<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { Show, ClerkProvider, SignInButton, UserButton } from 'svelte-clerk';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<ClerkProvider>
	<div class="min-h-screen bg-zinc-950 text-zinc-100">
		<header class="border-b border-zinc-800 px-6 py-4">
			<div class="mx-auto flex max-w-7xl items-center justify-between">
				<a href="/" class="text-2xl font-semibold tracking-tight text-emerald-400"> Sylvan </a>
				<div class="flex items-center gap-4">
					<a
						href="/scan"
						class="text-sm text-zinc-400 hover:text-zinc-200"
						data-sveltekit-preload-data
					>
						Scan
					</a>
					<Show when="signed-in">
						<a
							href="/collection"
							class="text-sm text-zinc-400 hover:text-zinc-200"
							data-sveltekit-preload-data
						>
							Collection
						</a>
					</Show>
					<a
						href="/trades"
						class="text-sm text-zinc-400 hover:text-zinc-200"
						data-sveltekit-preload-data
					>
						Trades
					</a>
					<Show when="signed-out">
						<SignInButton
							forceRedirectUrl="/trades"
							class="text-sm text-emerald-400 hover:text-zinc-200"
						/>
					</Show>
					<Show when="signed-in">
						<UserButton />
					</Show>
				</div>
			</div>
		</header>
		{@render children()}
		<footer class="border-t border-zinc-800 px-6 py-4">
			<div class="mx-auto max-w-7xl">
				<div class="flex items-center justify-center gap-4 text-sm text-zinc-400">
					<a href="/terms" class="hover:text-zinc-200" data-sveltekit-preload-data
						>Terms of Service</a
					>
					<span class="text-zinc-600">•</span>
					<a href="/privacy" class="hover:text-zinc-200" data-sveltekit-preload-data
						>Privacy Policy</a
					>
				</div>
			</div>
		</footer>
	</div>
</ClerkProvider>
