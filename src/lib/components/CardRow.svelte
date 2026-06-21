<script lang="ts">
	import type { WishlistCard } from '$lib/types';

	interface Props {
		card: WishlistCard;
		onClick: () => void;
	}

	let { card, onClick }: Props = $props();

	const conditionLabel = $derived(
		{
			NM: 'Near Mint',
			GD: 'Good',
			PL: 'Played',
			DM: 'Damaged'
		}[card.condition] || card.condition
	);
</script>

<button
	type="button"
	class="flex w-full items-center gap-3 rounded-lg border border-border bg-surface-raised p-3 text-left transition-colors hover:bg-surface-card"
	onclick={onClick}
>
	{#if card.imageUrl}
		<img
			src={card.imageUrl}
			alt={card.name}
			class="h-14 w-10 rounded object-cover"
			loading="lazy"
		/>
	{:else}
		<div class="flex h-14 w-10 items-center justify-center rounded bg-surface-card">
			<span class="text-[8px] text-text-muted">?</span>
		</div>
	{/if}
	<div class="min-w-0 flex-1">
		<p class="truncate text-sm font-medium text-text-soft">{card.name}</p>
		<div class="mt-0.5 flex flex-wrap items-center gap-2">
			{#if card.isFoil}
				<span class="text-[10px] font-medium text-accent">FOIL</span>
			{/if}
			{#if card.condition}
				<span class="text-[10px] text-text-dim">{conditionLabel}</span>
			{/if}
			{#if card.set}
				<span class="text-[10px] text-text-muted">{card.set.toUpperCase()}</span>
			{/if}
			{#if card.isSigned}
				<span class="text-[10px] text-text-muted">Signed</span>
			{/if}
			{#if card.isAltered}
				<span class="text-[10px] text-text-muted">Altered</span>
			{/if}
			{#if card.isTradeable === false}
				<span class="text-[10px] text-danger">Not tradeable</span>
			{/if}
		</div>
	</div>
	<span class="text-sm font-medium text-text">{card.qty}×</span>
</button>
