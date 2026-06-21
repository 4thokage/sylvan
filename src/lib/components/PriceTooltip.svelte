<script lang="ts">
	import type { WishlistCard } from '$lib/types';

	interface Props {
		card: WishlistCard;
		children: import('svelte').Snippet;
	}

	let { card, children }: Props = $props();

	let showTooltip = $state(false);
	let isMobile = $state(false);
	let showBottomSheet = $state(false);
	let buttonRef: HTMLButtonElement | null = $state(null);

	let tooltipStyle = $state('');

	$effect(() => {
		if (typeof window !== 'undefined') {
			isMobile = window.matchMedia('(hover: none)').matches;
		}
	});

	function handleInteraction() {
		if (isMobile) {
			showBottomSheet = true;
		} else {
			updateTooltipPosition();
			showTooltip = true;
		}
	}

	function updateTooltipPosition() {
		if (!buttonRef) return;
		const rect = buttonRef.getBoundingClientRect();
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const W = 256;
		const H = 220;
		const M = 8;

		const spaceBelow = vh - rect.bottom;
		const spaceAbove = rect.top;
		const showAbove = spaceAbove > spaceBelow && spaceAbove >= H + M;

		let left = rect.left + rect.width / 2;
		const halfW = W / 2;
		const minLeft = halfW + M;
		const maxLeft = vw - halfW - M;
		if (minLeft < maxLeft) {
			if (left < minLeft) left = minLeft;
			if (left > maxLeft) left = maxLeft;
		} else {
			left = vw / 2;
		}

		let top: number;
		if (showAbove) {
			top = rect.top - H - M;
			if (top < M) {
				top = rect.bottom + M;
			}
		} else {
			top = rect.bottom + M;
			if (top + H > vh - M) {
				top = rect.top - H - M;
				if (top < M) {
					top = (vh - H) / 2;
				}
			}
		}

		tooltipStyle = `left: ${left}px; top: ${top}px; transform: translateX(-50%);`;
	}

	function closeTooltip() {
		showTooltip = false;
	}

	function closeBottomSheet() {
		showBottomSheet = false;
	}

	function formatPrice(price: string | null): string {
		if (!price) return '—';
		return `$${price}`;
	}
</script>

<div class="relative inline-block">
	<button
		type="button"
		class="cursor-pointer"
		bind:this={buttonRef}
		onclick={handleInteraction}
		onmouseenter={!isMobile ? handleInteraction : undefined}
		onmouseleave={!isMobile ? closeTooltip : undefined}
	>
		{@render children()}
	</button>

	{#if !isMobile && showTooltip}
		<div
			class="fixed z-50 w-64 rounded-lg border border-border-strong bg-surface-raised p-4 shadow-xl"
			role="tooltip"
			style={tooltipStyle}
		>
			<h4 class="mb-3 border-b border-border-strong pb-2 text-sm font-semibold text-text">
				Prices
			</h4>
			{#if card.prices}
				<div class="grid grid-cols-2 gap-2 text-xs">
					<div class="text-text-dim">USD</div>
					<div class="text-right text-text">{formatPrice(card.prices.usd)}</div>
					<div class="text-text-dim">USD Foil</div>
					<div class="text-right text-accent">{formatPrice(card.prices.usdFoil)}</div>
					<div class="text-text-dim">EUR</div>
					<div class="text-right text-text">{formatPrice(card.prices.eur)}</div>
					<div class="text-text-dim">EUR Foil</div>
					<div class="text-right text-accent">{formatPrice(card.prices.eurFoil)}</div>
					<div class="text-text-dim">TIX</div>
					<div class="text-right text-text">{formatPrice(card.prices.tix)}</div>
				</div>
			{:else}
				<p class="text-xs text-text-muted">No price data available</p>
			{/if}
		</div>
	{/if}
</div>

{#if isMobile && showBottomSheet}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
		onclick={closeBottomSheet}
		role="dialog"
		aria-modal="true"
		aria-label="Price details"
		tabindex="-1"
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="w-full max-w-lg rounded-t-2xl border-t border-border-strong bg-surface-raised p-6 pb-8"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-lg font-semibold text-text">Pricing</h3>
				<button
					type="button"
					class="rounded p-2 text-text-dim hover:bg-surface-card"
					onclick={closeBottomSheet}
					aria-label="Close pricing dialog"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>
			{#if card.prices}
				<div class="space-y-3">
					<div class="flex justify-between border-b border-border pb-2">
						<span class="text-text-dim">USD</span>
						<span class="text-text">{formatPrice(card.prices.usd)}</span>
					</div>
					<div class="flex justify-between border-b border-border pb-2">
						<span class="text-text-dim">USD Foil</span>
						<span class="text-accent">{formatPrice(card.prices.usdFoil)}</span>
					</div>
					<div class="flex justify-between border-b border-border pb-2">
						<span class="text-text-dim">EUR</span>
						<span class="text-text">{formatPrice(card.prices.eur)}</span>
					</div>
					<div class="flex justify-between border-b border-border pb-2">
						<span class="text-text-dim">EUR Foil</span>
						<span class="text-accent">{formatPrice(card.prices.eurFoil)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-text-dim">TIX</span>
						<span class="text-text">{formatPrice(card.prices.tix)}</span>
					</div>
				</div>
			{:else}
				<p class="text-sm text-text-muted">No price data available</p>
			{/if}
		</div>
	</div>
{/if}
