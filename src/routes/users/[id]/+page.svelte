<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';

	interface Wishlist {
		id: string;
		title: string | null;
		game_slug: string | null;
		created_at: string;
	}

	interface Stack {
		user_card_id: string;
		quantity: number;
		condition: string;
		finish: string | null;
		language: string | null;
		card_name: string;
		set_code: string | null;
		collector_number: string | null;
		image_url: string | null;
	}

	interface Rating {
		id: string;
		rating: number;
		comment: string | null;
		created_at: string;
		rater_username: string | null;
	}

	interface Profile {
		id: string;
		username: string | null;
		created_at: string;
		wishlists: Wishlist[];
		stacks: Stack[];
		ratings: Rating[];
		average_rating: number | null;
		total_ratings: number;
	}

	const userId = $page.params.id;

	let profile = $state<Profile | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	async function loadProfile() {
		try {
			const res = await fetch(`/api/users/${userId}`);
			const result = await res.json();
			if (result.success) {
				profile = result.data as Profile;
			} else {
				error = result.error?.message || 'Failed to load profile';
			}
		} catch {
			error = 'Failed to load profile';
		} finally {
			isLoading = false;
		}
	}

	onMount(loadProfile);
</script>

<svelte:head>
	<title>Sylvan - {profile?.username || 'User Profile'}</title>
</svelte:head>

<div class="mx-auto max-w-4xl p-6">
	{#if isLoading}
		<div class="flex h-40 items-center justify-center">
			<div
				class="animate-spin mb-3 inline-block h-8 w-8 rounded-full border-4 border-border-strong border-t-emerald-500"
			></div>
		</div>
	{:else if error}
		<div class="rounded-lg bg-danger-bg p-4 text-sm text-danger">{error}</div>
	{:else if profile}
		<div class="mb-6">
			<h1 class="text-2xl font-semibold tracking-tight text-accent">
				{profile.username || 'Anonymous User'}
			</h1>
			<p class="text-sm text-text-dim">
				Member since {new Date(profile.created_at).toLocaleDateString()}
			</p>
			{#if profile.total_ratings > 0}
				<div class="mt-2 flex items-center gap-2 text-sm">
					<span class="text-yellow-400">★ {profile.average_rating}</span>
					<span class="text-text-muted">({profile.total_ratings} ratings)</span>
				</div>
			{/if}
		</div>

		<div class="grid gap-6 md:grid-cols-2">
			<div>
				<h2 class="mb-3 text-lg font-medium text-text-soft">Public Wishlists</h2>
				{#if profile.wishlists.length === 0}
					<p class="text-sm text-text-dim">No public wishlists.</p>
				{:else}
					<div class="space-y-2">
						{#each profile.wishlists as w (w.id)}
							<a
								href={resolve(`/${w.id}`)}
								class="block rounded-lg border border-border bg-surface-raised p-3 hover:bg-surface-card"
							>
								<p class="text-sm font-medium text-text">{w.title || 'Untitled'}</p>
								<p class="text-xs text-text-dim">
									{w.game_slug} • {new Date(w.created_at).toLocaleDateString()}
								</p>
							</a>
						{/each}
					</div>
				{/if}
			</div>

			<div>
				<h2 class="mb-3 text-lg font-medium text-text-soft">Tradeable Cards</h2>
				{#if profile.stacks.length === 0}
					<p class="text-sm text-text-dim">No tradeable cards.</p>
				{:else}
					<div class="space-y-2">
						{#each profile.stacks as s (s.user_card_id)}
							<div
								class="flex items-center gap-3 rounded-lg border border-border bg-surface-raised p-3"
							>
								{#if s.image_url}
									<img src={s.image_url} alt={s.card_name} class="h-12 w-8 rounded object-cover" />
								{/if}
								<div class="text-sm">
									<p class="text-text">{s.quantity}x {s.card_name}</p>
									<p class="text-text-dim">
										{[s.set_code, s.collector_number, s.finish, s.condition]
											.filter(Boolean)
											.join(', ')}
									</p>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		{#if profile.ratings.length > 0}
			<div class="mt-8">
				<h2 class="mb-3 text-lg font-medium text-text-soft">Ratings</h2>
				<div class="space-y-2">
					{#each profile.ratings as r (r.id)}
						<div class="rounded-lg border border-border bg-surface-raised p-3">
							<div class="flex items-center justify-between">
								<span class="text-sm text-text-soft">{r.rater_username || 'Unknown'}</span>
								<span class="text-sm text-yellow-400"
									>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span
								>
							</div>
							{#if r.comment}
								<p class="mt-1 text-sm text-text-dim">{r.comment}</p>
							{/if}
							<p class="mt-1 text-xs text-text-muted">
								{new Date(r.created_at).toLocaleDateString()}
							</p>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
