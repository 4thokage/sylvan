<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
</script>

<svelte:head>
	<title>Wishlist Not Found - Sylvan Web</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-surface p-6 text-text">
	<div class="text-center">
		<div class="mb-6 text-8xl">🔍</div>
		<h1 class="mb-4 text-4xl font-bold text-text">Wishlist Not Found</h1>
		<p class="mb-8 text-lg text-text-dim">
			The wishlist you're looking for doesn't exist or may have been deleted.
		</p>
		<a
			href="/"
			class="inline-flex items-center gap-2 rounded-lg bg-accent-bg px-6 py-3 text-white transition-colors hover:bg-accent-hover"
			data-sveltekit-preload-data
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5"
				viewBox="0 0 20 20"
				fill="currentColor"
			>
				<path
					fill-rule="evenodd"
					d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
					clip-rule="evenodd"
				/>
			</svg>
			Create New Wishlist
		</a>
	</div>
</div>
