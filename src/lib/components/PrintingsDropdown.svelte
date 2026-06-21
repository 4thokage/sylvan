<script lang="ts">
	import type { CardPrint, WishlistCard } from '$lib/types';

	interface Props {
		card: WishlistCard;
		onSelect: (print: CardPrint, index: number) => void;
		isOpen?: boolean;
		positionRef?: HTMLElement | null;
		gameSlug?: string;
	}

	let { card, onSelect, isOpen = false, positionRef = null, gameSlug = 'mtg' }: Props = $props();

	let printings = $state<CardPrint[]>([]);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let hasFetched = $state(false);

	let dropdownStyle = $state('');

	$effect(() => {
		card.name;
		gameSlug;
		printings = [];
		isLoading = false;
		error = null;
		hasFetched = false;
	});

	$effect(() => {
		if (isOpen && !isLoading && !hasFetched && printings.length === 0) {
			loadPrintings();
		}
	});

	$effect(() => {
		if (isOpen && positionRef) {
			updateDropdownPosition();
		}
	});

	async function loadPrintings() {
		hasFetched = true;
		isLoading = true;
		error = null;

		try {
			const response = await fetch(`/api/cards/printings?name=${encodeURIComponent(card.name)}&game=${encodeURIComponent(gameSlug)}`);
			const result = await response.json();
			if (result.success && result.data?.printings) {
				printings = result.data.printings.map((p: Record<string, unknown>) => ({
					id: p.id as string,
					name: card.name,
					set: p.setCode as string,
					setName: p.setName as string,
					collectorNumber: p.collectorNumber as string,
					rarity: p.rarity as string,
					price: p.price as string | null,
					priceFoil: p.priceFoil as string | null,
					imageUrl: p.imageUrl as string | null,
					manaCost: p.manaCost as string | null
				}));
			} else {
				throw new Error(result.error?.message || 'Failed to load printings');
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load printings';
		} finally {
			isLoading = false;
		}
	}

	function updateDropdownPosition() {
		if (!positionRef) return;
		const rect = positionRef.getBoundingClientRect();
		const viewportHeight = window.innerHeight;
		const showAbove = rect.top > viewportHeight * 0.65;

		const horizontal = rect.left + rect.width / 2;
		const vertical = showAbove ? rect.top : rect.bottom + 8;

		dropdownStyle = `left: ${horizontal}px; top: ${vertical}px; transform: translateX(-50%);`;
	}

	function selectPrint(print: CardPrint, index: number) {
		onSelect(print, index);
	}

	function formatPrice(price: string | null): string {
		if (!price) return '—';
		return `$${price}`;
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.printings-dropdown')) {
			// Let parent handle closing
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="printings-dropdown relative inline-block">
	{#if isOpen}
		<div
			class="fixed z-50 max-h-96 w-80 overflow-hidden rounded-lg border border-border-strong bg-surface-raised shadow-xl"
			style={dropdownStyle}
		>
			<div class="border-b border-border-strong px-3 py-2">
				<h4 class="text-sm font-semibold text-text">Select Printing</h4>
				<p class="text-xs text-text-muted">{card.name} · {printings.length} printings</p>
			</div>

			{#if isLoading}
				<div class="flex items-center justify-center p-8">
					<div
						class="h-6 w-6 animate-spin rounded-full border-2 border-border-strong border-t-emerald-500"
					></div>
				</div>
			{:else if error}
				<div class="p-4">
					<p class="text-sm text-danger">{error}</p>
				</div>
			{:else}
				<div class="max-h-72 overflow-y-auto p-2">
					{#each printings as print, index (print.id)}
						<button
							type="button"
							class="flex w-full items-center gap-3 rounded p-2 text-left transition-colors hover:bg-surface-card {card.selectedPrintIndex ===
							index
								? 'bg-surface-card'
								: ''}"
							onclick={() => selectPrint(print, index)}
						>
							<div class="h-16 w-12 flex-shrink-0 overflow-hidden rounded bg-surface-card">
								{#if print.imageUrl}
									<img
										src={print.imageUrl}
										alt={print.setName}
										class="h-full w-full object-cover"
										loading="lazy"
									/>
								{/if}
							</div>
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<span class="text-xs font-medium text-text-soft uppercase">{print.set}</span>
									<span class="text-xs text-text-muted">#{print.collectorNumber}</span>
									<span
										class="rounded px-1 py-0.5 text-[10px] uppercase {print.rarity === 'mythic'
											? 'bg-orange-900/50 text-orange-300'
											: print.rarity === 'rare'
												? 'bg-yellow-900/50 text-yellow-300'
												: print.rarity === 'uncommon'
													? 'bg-gray-600/50 text-gray-300'
													: 'bg-gray-800 text-gray-400'}"
									>
										{print.rarity}
									</span>
								</div>
								<p class="truncate text-xs text-text-dim">{print.setName}</p>
								<div class="mt-1 flex gap-3">
									<span class="text-xs text-text-soft">{formatPrice(print.price)}</span>
									{#if print.priceFoil}
										<span class="text-xs text-accent">{formatPrice(print.priceFoil)} foil</span
										>
									{/if}
								</div>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
