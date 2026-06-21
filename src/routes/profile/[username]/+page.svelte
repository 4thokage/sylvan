<script lang="ts">
	let { data } = $props();
	const profile = $derived(data.profile);
	const collection = $derived(data.collection);
</script>

<svelte:head>
	<title>{profile.display_name || profile.username} - Sylvan Profile</title>
	<meta name="description" content={profile.bio ? profile.bio.slice(0, 160) : `${profile.display_name || profile.username}'s TCG collection on Sylvan`} />
	<meta property="og:title" content="{profile.display_name || profile.username} - Sylvan Profile" />
	<meta property="og:description" content={profile.bio ? profile.bio.slice(0, 160) : 'TCG collector on Sylvan'} />
</svelte:head>

<div class="mx-auto max-w-4xl p-6">
	<div class="mb-8 rounded-lg border border-border bg-surface-raised p-6">
		<div class="flex items-start gap-6">
			<div class="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-900 text-2xl font-bold text-accent">
				{(profile.display_name || profile.username || '?')[0].toUpperCase()}
			</div>
			<div class="flex-1">
				<h1 class="text-2xl font-semibold text-text">
					{profile.display_name || profile.username}
				</h1>
				<p class="text-sm text-text-muted">@{profile.username}</p>
				{#if profile.location}
					<p class="mt-1 text-sm text-text-dim">📍 {profile.location}</p>
				{/if}
				{#if profile.bio}
					<p class="mt-3 text-text-soft">{profile.bio}</p>
				{/if}
			</div>
		</div>
	</div>

	<div class="mb-6">
		<h2 class="text-lg font-semibold text-text">
			Public Collection
			<span class="ml-2 text-sm font-normal text-text-muted">
				{collection.uniqueCards} unique · {collection.totalCards} total
			</span>
		</h2>
	</div>

	{#if collection.cards.length === 0}
		<div class="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-border">
			<p class="text-sm text-text-muted">This collection is empty or private</p>
		</div>
	{:else}
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
			{#each collection.cards as card (card.card_name)}
				<div class="rounded-lg border border-border bg-surface-raised p-3">
					<div class="aspect-[5/7] mb-2 overflow-hidden rounded bg-surface-card">
						{#if card.image_url}
							<img src={card.image_url} alt={card.card_name} class="h-full w-full object-cover" loading="lazy" />
						{/if}
					</div>
					<p class="truncate text-xs text-text-soft">{card.card_name}</p>
					<div class="mt-1 flex items-center gap-2">
						<span class="text-xs text-text-muted">×{card.quantity}</span>
						{#if card.is_foil}
							<span class="text-xs text-accent">Foil</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
