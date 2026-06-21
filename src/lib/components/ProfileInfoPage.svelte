<script lang="ts">
	import { useClerkContext } from 'svelte-clerk';

	let clerkCtx = useClerkContext();
	let user = $derived(clerkCtx.user);

	let bio = $state('');
	let location = $state('');
	let isSaving = $state(false);
	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	$effect(() => {
		if (user) {
			const meta = (user.unsafeMetadata || {}) as Record<string, string>;
			bio = meta.bio || '';
			location = meta.location || '';
		}
	});

	async function saveProfile() {
		if (!user) return;
		isSaving = true;
		message = null;

		try {
			await user.update({
				unsafeMetadata: {
					...(user.unsafeMetadata || {}),
					bio,
					location
				}
			});
			message = { type: 'success', text: 'Profile updated!' };
			setTimeout(() => (message = null), 3000);
		} catch (err) {
			message = {
				type: 'error',
				text: err instanceof Error ? err.message : 'Failed to update profile'
			};
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="space-y-4 p-4">
	<h2 class="text-lg font-semibold text-text">Profile Info</h2>

	{#if message}
		<div
			class="rounded-lg p-3 text-sm {message.type === 'success'
				? 'bg-emerald-900/20 text-accent'
				: 'bg-danger-bg text-danger'}"
		>
			{message.text}
		</div>
	{/if}

	<div>
		<label class="mb-1 block text-sm font-medium text-text-dim">Bio</label>
		<textarea
			bind:value={bio}
			placeholder="Tell other traders about yourself..."
			maxlength={1000}
			rows={4}
			class="w-full resize-none rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm text-text placeholder-text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/50 focus:outline-none"
		></textarea>
		<p class="mt-1 text-xs text-text-muted">{bio.length}/1000</p>
	</div>

	<div>
		<label class="mb-1 block text-sm font-medium text-text-dim">Location</label>
		<input
			type="text"
			bind:value={location}
			placeholder="City, Country"
			class="w-full rounded-lg border border-border bg-surface-raised px-4 py-2 text-text placeholder-text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/50 focus:outline-none"
		/>
		<p class="mt-1 text-xs text-text-muted">Helps find local trade partners</p>
	</div>

	<div class="flex justify-end">
		<button
			onclick={saveProfile}
			disabled={isSaving}
			class="rounded-lg bg-accent-bg px-6 py-2 font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-hover"
		>
			{isSaving ? 'Saving...' : 'Save Profile'}
		</button>
	</div>
</div>
