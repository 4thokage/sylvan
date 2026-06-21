<script lang="ts">
	let locale = $state('en');
	$effect(() => {
		if (typeof navigator !== 'undefined') {
			locale = navigator.language?.startsWith('pt') ? 'pt' : 'en';
		}
	});
</script>

<svelte:head>
	<title>Sylvan - Offline</title>
</svelte:head>

<div class="mx-auto max-w-7xl p-6">
	<div class="flex min-h-[60vh] flex-col items-center justify-center text-center">
		<svg class="mb-6 h-16 w-16 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18.364 5.636a9 9 0 11-12.728 0M12 9v4m0 4h.01" />
		</svg>
		<h1 class="mb-3 text-2xl font-semibold text-text-soft">
			{locale === 'pt' ? 'Você está offline' : 'You are offline'}
		</h1>
		<p class="mb-6 text-text-muted">
			{locale === 'pt' ? 'Conecte-se à internet para continuar usando o Sylvan.' : 'Connect to the internet to continue using Sylvan.'}
		</p>
		<a href="/" class="rounded-lg bg-accent-bg px-6 py-3 text-white hover:bg-accent-hover">
			{locale === 'pt' ? 'Tentar novamente' : 'Try Again'}
		</a>
	</div>
</div>
