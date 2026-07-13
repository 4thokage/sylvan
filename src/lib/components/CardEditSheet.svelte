<script lang="ts">
	import type { WishlistCard, CardPrinting, CardCondition } from '$lib/types';

	interface Props {
		card: WishlistCard;
		isOpen: boolean;
		gameSlug: string;
		isCollection: boolean;
		onSave: (updated: WishlistCard) => void;
		onRemove?: () => void;
		onClose: () => void;
	}

	let { card, isOpen, gameSlug, isCollection, onSave, onRemove, onClose }: Props = $props();

	let printings = $state<CardPrinting[]>([]);
	let isLoadingPrintings = $state(false);
	let printingsError = $state<string | null>(null);

	let condition = $state<CardCondition>('NM');
	let aftermarketSigned = $state(false);
	let isAltered = $state(false);
	let isTradeable = $state(true);
	let selectedPrint = $state<CardPrinting | null>(null);

	const CONDITIONS: Array<{ value: CardCondition; label: string }> = [
		{ value: 'NM', label: 'Near Mint' },
		{ value: 'LP', label: 'Lightly Played' },
		{ value: 'MP', label: 'Moderately Played' },
		{ value: 'HP', label: 'Heavily Played' },
		{ value: 'DMG', label: 'Damaged' }
	];

	$effect(() => {
		if (isOpen && printings.length === 0 && !isLoadingPrintings && !printingsError) {
			loadPrintings();
		}
	});

	$effect(() => {
		if (isOpen) {
			condition = card.condition;
			aftermarketSigned = card.aftermarketSigned;
			isAltered = card.isAltered;
			isTradeable = card.isTradeable ?? true;
			if (card.printings && card.cardPrintingId) {
				selectedPrint = card.printings.find((p) => p.id === card.cardPrintingId) || null;
			} else {
				selectedPrint = null;
			}
		}
	});

	async function loadPrintings() {
		isLoadingPrintings = true;
		printingsError = null;
		try {
			const response = await fetch(
				`/api/cards/printings?name=${encodeURIComponent(card.name)}&game=${encodeURIComponent(gameSlug)}`
			);
			const result = await response.json();
			if (result.success && result.data?.printings) {
				printings = result.data.printings.map((p: Record<string, unknown>) => ({
					id: p.id as string,
					cardId: '',
					setCode: p.setCode as string,
					setName: p.setName as string,
					collectorNumber: p.collectorNumber as string | null,
					rarity: p.rarity as string | null,
					prices: {
						usd: (p.price as string) || null,
						eur: (p.priceEur as string) || null
					},
					imageUrl: p.imageUrl as string | null,
					manaCost: p.manaCost as string | null,
					language: p.language as string,
					finish: p.finish as CardPrinting['finish'],
					factorySigned: p.factorySigned as boolean,
					releasedAt: null
				}));
			} else {
				throw new Error(result.error?.message || 'Failed to load printings');
			}
		} catch (err) {
			printingsError = err instanceof Error ? err.message : 'Failed to load printings';
		} finally {
			isLoadingPrintings = false;
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onClose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}

	function selectPrinting(print: CardPrinting) {
		selectedPrint = print;
	}

	function handleSave() {
		const updated: WishlistCard = {
			...card,
			condition,
			finish: selectedPrint?.finish || card.finish,
			language: selectedPrint?.language || card.language,
			aftermarketSigned,
			isAltered,
			isTradeable: isCollection ? isTradeable : card.isTradeable,
			cardPrintingId: selectedPrint?.id || card.cardPrintingId,
			printings: printings.length > 0 ? printings : card.printings,
			imageUrl: selectedPrint?.imageUrl || card.imageUrl,
			manaCost: selectedPrint?.manaCost || card.manaCost,
			prices: selectedPrint ? selectedPrint.prices : card.prices,
			set: selectedPrint?.setCode || card.set,
			collectorNumber: selectedPrint?.collectorNumber || card.collectorNumber
		};
		onSave(updated);
	}

	function formatPrice(price: string | null): string {
		if (!price) return '—';
		return `$${price}`;
	}
</script>

<svelte:window onkeydown={isOpen ? handleKeydown : undefined} />

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-label="Edit card attributes"
		tabindex="-1"
	>
		<div
			class="w-full max-w-lg rounded-t-2xl border-t border-border-strong bg-surface-raised p-6 pb-8 md:rounded-lg md:border md:shadow-xl"
			onclick={(e) => e.stopPropagation()}
			role="presentation"
		>
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-lg font-semibold text-text">{card.name}</h3>
				<button
					type="button"
					class="rounded p-2 text-text-dim hover:bg-surface-card"
					onclick={onClose}
					aria-label="Close"
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

			<div class="space-y-5">
				<!-- Printings -->
				<div>
					<span class="mb-2 block text-sm font-medium text-text-dim">Printing</span>
					{#if isLoadingPrintings}
						<div class="flex items-center gap-2 py-4">
							<div
								class="h-5 w-5 animate-spin rounded-full border-2 border-border-strong border-t-emerald-500"
							></div>
							<span class="text-sm text-text-muted">Loading printings...</span>
						</div>
					{:else if printingsError}
						<p class="text-sm text-danger">{printingsError}</p>
					{:else if printings.length > 0}
						<div class="flex gap-3 overflow-x-auto pb-2">
							{#each printings as print (print.id)}
								<button
									type="button"
									class="flex-shrink-0 rounded-lg border-2 p-1 text-left transition-colors {selectedPrint?.id ===
									print.id
										? 'border-accent bg-surface-card'
										: 'border-transparent hover:border-border-strong'}"
									onclick={() => selectPrinting(print)}
									aria-label="{print.setName} ({print.setCode}) #{print.collectorNumber}"
								>
									<div class="h-20 w-14 overflow-hidden rounded bg-surface-card">
										{#if print.imageUrl}
											<img
												src={print.imageUrl}
												alt=""
												class="h-full w-full object-cover"
												loading="lazy"
											/>
										{/if}
									</div>
									<div class="mt-1 px-1">
										<p class="text-[10px] font-medium uppercase text-text-soft">
											{print.setCode}
										</p>
										<p class="text-[10px] text-text-muted">#{print.collectorNumber}</p>
										<p class="text-[10px] text-accent">{print.finish}</p>
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Condition -->
				<div>
					<span class="mb-2 block text-sm font-medium text-text-dim">Condition</span>
					<div class="grid grid-cols-5 gap-2">
						{#each CONDITIONS as cond (cond.value)}
							<button
								type="button"
								class="rounded-lg border px-2 py-2 text-xs transition-colors {condition ===
								cond.value
									? 'border-accent bg-accent-bg/10 text-accent'
									: 'border-border-strong text-text-dim hover:bg-surface-card'}"
								onclick={() => (condition = cond.value)}
							>
								{cond.label}
							</button>
						{/each}
					</div>
				</div>

				<!-- Toggles -->
				<div class="grid grid-cols-2 gap-4">
					<button
						type="button"
						class="flex items-center justify-between rounded-lg border border-border-strong p-3 text-sm transition-colors {aftermarketSigned
							? 'bg-accent-bg/10 text-accent border-accent'
							: 'text-text-dim hover:bg-surface-card'}"
						onclick={() => (aftermarketSigned = !aftermarketSigned)}
					>
						<span>Signed</span>
						<span
							class="flex h-5 w-5 items-center justify-center rounded-full {aftermarketSigned
								? 'bg-accent text-white'
								: 'bg-surface-card'}"
						>
							{#if aftermarketSigned}
								<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="3"
										d="M5 13l4 4L19 7"
									/>
								</svg>
							{/if}
						</span>
					</button>

					<button
						type="button"
						class="flex items-center justify-between rounded-lg border border-border-strong p-3 text-sm transition-colors {isAltered
							? 'bg-accent-bg/10 text-accent border-accent'
							: 'text-text-dim hover:bg-surface-card'}"
						onclick={() => (isAltered = !isAltered)}
					>
						<span>Altered</span>
						<span
							class="flex h-5 w-5 items-center justify-center rounded-full {isAltered
								? 'bg-accent text-white'
								: 'bg-surface-card'}"
						>
							{#if isAltered}
								<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="3"
										d="M5 13l4 4L19 7"
									/>
								</svg>
							{/if}
						</span>
					</button>

					{#if isCollection}
						<button
							type="button"
							class="flex items-center justify-between rounded-lg border border-border-strong p-3 text-sm transition-colors {isTradeable
								? 'bg-accent-bg/10 text-accent border-accent'
								: 'text-text-dim hover:bg-surface-card'}"
							onclick={() => (isTradeable = !isTradeable)}
						>
							<span>Tradeable</span>
							<span
								class="flex h-5 w-5 items-center justify-center rounded-full {isTradeable
									? 'bg-accent text-white'
									: 'bg-surface-card'}"
							>
								{#if isTradeable}
									<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="3"
											d="M5 13l4 4L19 7"
										/>
									</svg>
								{/if}
							</span>
						</button>
					{/if}
				</div>

				<!-- Selected printing price preview -->
				{#if selectedPrint}
					<div class="rounded-lg border border-border bg-surface-card p-3">
						<div class="flex items-center justify-between text-sm">
							<span class="text-text-dim">{selectedPrint.setName} ({selectedPrint.setCode})</span>
							<span class="text-text-soft">{formatPrice(selectedPrint.prices.usd)}</span>
						</div>
						<div class="mt-1 flex items-center justify-between text-sm">
							<span class="text-text-muted">EUR</span>
							<span class="text-text">{formatPrice(selectedPrint.prices.eur)}</span>
						</div>
					</div>
				{/if}
			</div>

			<div class="mt-6 flex gap-3">
				{#if onRemove}
					<button
						type="button"
						class="rounded-lg border border-danger bg-danger-bg px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/20"
						onclick={onRemove}
					>
						Remove
					</button>
				{/if}
				<button
					type="button"
					class="flex-1 rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-text-dim transition-colors hover:bg-surface-card"
					onclick={onClose}
				>
					Cancel
				</button>
				<button
					type="button"
					class="flex-1 rounded-lg bg-accent-bg px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
					onclick={handleSave}
				>
					Save
				</button>
			</div>
		</div>
	</div>
{/if}
