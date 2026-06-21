<script lang="ts">
	import { useClerkContext } from 'svelte-clerk';
	import { getLocaleStore, t } from '$lib/i18n';

	let clerkCtx = useClerkContext();
	let localeStore = getLocaleStore();
	let user = $derived(clerkCtx.user);

	let bio = $state('');
	let location = $state('');
	let country = $state('');
	let isSaving = $state(false);
	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	$effect(() => {
		if (user) {
			const meta = (user.unsafeMetadata || {}) as Record<string, string>;
			bio = meta.bio || '';
			location = meta.location || '';
			country = meta.country || '';
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
					location,
					country
				}
			});
			message = { type: 'success', text: t($localeStore, 'profile.updated') };
			setTimeout(() => (message = null), 3000);
		} catch (err) {
			message = {
				type: 'error',
				text: err instanceof Error ? err.message : t($localeStore, 'common.error')
			};
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="space-y-4 p-4">
	<h2 class="text-lg font-semibold text-text">{t($localeStore, 'profile.bio')}</h2>

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
		<label class="mb-1 block text-sm font-medium text-text-dim"
			>{t($localeStore, 'profile.bio')}</label
		>
		<textarea
			bind:value={bio}
			placeholder={t($localeStore, 'profile.bioPlaceholder')}
			maxlength={1000}
			rows={4}
			class="w-full resize-none rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm text-text placeholder-text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/50 focus:outline-none"
		></textarea>
		<p class="mt-1 text-xs text-text-muted">{bio.length}/1000</p>
	</div>

	<div>
		<label class="mb-1 block text-sm font-medium text-text-dim"
			>{t($localeStore, 'profile.location')}</label
		>
		<input
			type="text"
			bind:value={location}
			placeholder={t($localeStore, 'profile.locationPlaceholder')}
			class="w-full rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm text-text placeholder-text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/50 focus:outline-none"
		/>
	</div>

	<div>
		<label class="mb-1 block text-sm font-medium text-text-dim"
			>{t($localeStore, 'profile.country')}</label
		>
		<input
			type="text"
			bind:value={country}
			placeholder="USA, Germany, Japan..."
			class="w-full rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm text-text placeholder-text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/50 focus:outline-none"
		/>
	</div>

	<div class="flex justify-end">
		<button
			onclick={saveProfile}
			disabled={isSaving}
			class="rounded-lg bg-accent-bg px-6 py-2 font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-hover"
		>
			{isSaving ? t($localeStore, 'profile.saving') : t($localeStore, 'profile.save')}
		</button>
	</div>
</div>
