<script lang="ts">
	import { getLocaleStore } from '$lib/i18n';

	let store = getLocaleStore();
</script>

<button
	onclick={() => store.toggle()}
	class="rounded border border-border-strong px-2 py-1 text-xs text-text-dim hover:bg-surface-card hover:text-text"
	aria-label="Toggle language"
>
	{$store === 'en' ? 'PT' : 'EN'}
</button>
