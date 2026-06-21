<script lang="ts">
	import { useClerkContext } from 'svelte-clerk';

	let { data } = $props();
	let clerkCtx = useClerkContext();
	let isSignedIn = $derived(!!clerkCtx.user || !!data.user);

	let displayName = $state('');
	let bio = $state('');
	let location = $state('');
	let isPublic = $state(false);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	$effect(() => {
		if (isSignedIn && isLoading) {
			loadProfile();
		}
	});

	async function loadProfile() {
		try {
			const response = await fetch('/api/user/profile');
			const result = await response.json();
			if (result.success && result.data?.profile) {
				const p = result.data.profile;
				displayName = p.display_name || '';
				bio = p.bio || '';
				location = p.location || '';
				isPublic = p.is_public || false;
			}
		} catch (err) {
			console.error('Failed to load profile', err);
		} finally {
			isLoading = false;
		}
	}

	async function saveProfile() {
		isSaving = true;
		message = null;

		try {
			const response = await fetch('/api/user/profile', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					display_name: displayName,
					bio,
					location,
					is_public: isPublic
				})
			});

			const result = await response.json();
			if (result.success) {
				message = { type: 'success', text: 'Profile saved!' };
				setTimeout(() => (message = null), 3000);
			} else {
				message = { type: 'error', text: result.error?.message || 'Failed to save profile' };
			}
		} catch {
			message = { type: 'error', text: 'Failed to save profile' };
		} finally {
			isSaving = false;
		}
	}
</script>

<svelte:head>
	<title>Sylvan - Profile Settings</title>
</svelte:head>

<div class="mx-auto max-w-2xl p-6">
	{#if !isSignedIn}
		<div class="flex min-h-[40vh] flex-col items-center justify-center text-center">
			<h2 class="mb-4 text-2xl font-semibold">Sign in to manage your profile</h2>
			<p class="text-text-dim">Create a public profile to connect with other traders.</p>
		</div>
	{:else if isLoading}
		<div class="flex h-40 items-center justify-center">
			<div class="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-border-strong border-t-emerald-500"></div>
		</div>
	{:else}
		<div class="mb-8">
			<h1 class="text-2xl font-semibold tracking-tight text-accent">Profile Settings</h1>
			<p class="mt-1 text-sm text-text-muted">Customize your public profile</p>
		</div>

		{#if message}
			<div
				class="mb-4 rounded-lg p-3 text-sm {message.type === 'success' ? 'bg-emerald-900/20 text-accent' : 'bg-danger-bg text-danger'}"
			>
				{message.text}
			</div>
		{/if}

		<form onsubmit={(e) => { e.preventDefault(); saveProfile(); }} class="space-y-6">
			<div>
				<label for="displayName" class="mb-1 block text-sm font-medium text-text-dim">
					Display Name
				</label>
				<input
					id="displayName"
					type="text"
					bind:value={displayName}
					placeholder="Your display name"
					maxlength={128}
					class="w-full rounded-lg border border-border bg-surface-raised px-4 py-2 text-text placeholder-text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/50 focus:outline-none"
				/>
			</div>

			<div>
				<label for="bio" class="mb-1 block text-sm font-medium text-text-dim">
					Bio
				</label>
				<textarea
					id="bio"
					bind:value={bio}
					placeholder="Tell other traders about yourself..."
					maxlength={1000}
					rows={4}
					class="w-full resize-none rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm text-text placeholder-text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/50 focus:outline-none"
				></textarea>
				<p class="mt-1 text-xs text-text-muted">{bio.length}/1000</p>
			</div>

			<div>
				<label for="location" class="mb-1 block text-sm font-medium text-text-dim">
					Location
				</label>
				<input
					id="location"
					type="text"
					bind:value={location}
					placeholder="City, Country"
					class="w-full rounded-lg border border-border bg-surface-raised px-4 py-2 text-text placeholder-text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/50 focus:outline-none"
				/>
				<p class="mt-1 text-xs text-text-muted">Helps find local trade partners</p>
			</div>

			<div class="flex items-center gap-3">
				<input
					id="isPublic"
					type="checkbox"
					bind:checked={isPublic}
					class="h-4 w-4 rounded border-border-strong bg-surface-raised text-emerald-600 focus:ring-accent"
				/>
				<label for="isPublic" class="text-sm text-text-soft">
					Make my profile and collection public
				</label>
			</div>

			<div class="flex justify-end">
				<button
					type="submit"
					disabled={isSaving}
					class="rounded-lg bg-accent-bg px-6 py-2 font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-hover"
				>
					{isSaving ? 'Saving...' : 'Save Profile'}
				</button>
			</div>
		</form>
	{/if}
</div>
