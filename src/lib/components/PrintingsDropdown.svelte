<script lang="ts">
	import type { CardPrint, WishlistCard } from '$lib/scryfall/api';
	import { fetchAllPrintings } from '$lib/scryfall/api';

	interface Props {
		card: WishlistCard;
		onSelect: (print: CardPrint, index: number) => void;
		isOpen?: boolean;
		positionRef?: HTMLElement | null;
	}

	let { card, onSelect, isOpen = false, positionRef = null }: Props = $props();

	let printings = $state<CardPrint[]>([]);
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	let dropdownStyle = $state('');

	$effect(() => {
		if (isOpen && printings.length === 0 && !isLoading) {
			loadPrintings();
		}
	});

	$effect(() => {
		if (isOpen && positionRef) {
			updateDropdownPosition();
		}
	});

	async function loadPrintings() {
		isLoading = true;
		error = null;

		try {
			printings = await fetchAllPrintings(card.name);
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
			class="fixed z-50 max-h-96 w-80 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl"
			style={dropdownStyle}
		>
			<div class="border-b border-zinc-700 px-3 py-2">
				<h4 class="text-sm font-semibold text-zinc-200">Select Printing</h4>
				<p class="text-xs text-zinc-500">{card.name} · {printings.length} printings</p>
			</div>

			{#if isLoading}
				<div class="flex items-center justify-center p-8">
					<div
						class="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500"
					></div>
				</div>
			{:else if error}
				<div class="p-4">
					<p class="text-sm text-red-400">{error}</p>
				</div>
			{:else}
				<div class="max-h-72 overflow-y-auto p-2">
					{#each printings as print, index (print.id)}
						<button
							type="button"
							class="flex w-full items-center gap-3 rounded p-2 text-left transition-colors hover:bg-zinc-800 {card.selectedPrintIndex ===
							index
								? 'bg-zinc-800'
								: ''}"
							onclick={() => selectPrint(print, index)}
						>
							<div class="h-16 w-12 flex-shrink-0 overflow-hidden rounded bg-zinc-800">
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
									<span class="text-xs font-medium text-zinc-300 uppercase">{print.set}</span>
									<span class="text-xs text-zinc-500">#{print.collectorNumber}</span>
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
								<p class="truncate text-xs text-zinc-400">{print.setName}</p>
								<div class="mt-1 flex gap-3">
									<span class="text-xs text-zinc-300">{formatPrice(print.price)}</span>
									{#if print.priceFoil}
										<span class="text-xs text-emerald-400">{formatPrice(print.priceFoil)} foil</span
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
