<script lang="ts">
	import type { WishlistCard, CardPrint } from '$lib/types';

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

	let printings = $state<CardPrint[]>([]);
	let isLoadingPrintings = $state(false);
	let printingsError = $state<string | null>(null);

	let condition = $state('NM');
	let isFoil = $state(false);
	let isSigned = $state(false);
	let isAltered = $state(false);
	let language = $state('en');
	let isTradeable = $state(true);
	let selectedPrint = $state<CardPrint | null>(null);
	let selectedPrintIndex = $state(-1);

	let isMobile = $state(false);

	const CONDITIONS = [
		{ value: 'NM', label: 'Near Mint' },
		{ value: 'GD', label: 'Good' },
		{ value: 'PL', label: 'Played' },
		{ value: 'DM', label: 'Damaged' }
	];

	const LANGUAGES = [
		{ value: 'en', label: 'English' },
		{ value: 'ja', label: 'Japanese' },
		{ value: 'de', label: 'German' },
		{ value: 'fr', label: 'French' },
		{ value: 'es', label: 'Spanish' },
		{ value: 'it', label: 'Italian' },
		{ value: 'pt', label: 'Portuguese' },
		{ value: 'ko', label: 'Korean' },
		{ value: 'zh', label: 'Chinese' }
	];

	$effect(() => {
		if (typeof window !== 'undefined') {
			isMobile = window.matchMedia('(hover: none)').matches;
		}
	});

	$effect(() => {
		if (isOpen && printings.length === 0 && !isLoadingPrintings && !printingsError) {
			loadPrintings();
		}
	});

	$effect(() => {
		if (isOpen) {
			condition = card.condition;
			isFoil = card.isFoil;
			isSigned = card.isSigned;
			isAltered = card.isAltered;
			language = card.language;
			isTradeable = card.isTradeable ?? true;
			selectedPrintIndex = card.selectedPrintIndex ?? -1;
			if (card.printings && card.selectedPrintIndex !== undefined) {
				selectedPrint = card.printings[card.selectedPrintIndex] || null;
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

	function selectPrinting(print: CardPrint, index: number) {
		selectedPrint = print;
		selectedPrintIndex = index;
	}

	function handleSave() {
		const updated: WishlistCard = {
			...card,
			condition,
			isFoil,
			isSigned,
			isAltered,
			language,
			isTradeable: isCollection ? isTradeable : card.isTradeable,
			selectedPrintIndex: selectedPrintIndex >= 0 ? selectedPrintIndex : undefined,
			printings: printings.length > 0 ? printings : card.printings,
			imageUrl: selectedPrint?.imageUrl || card.imageUrl,
			manaCost: selectedPrint?.manaCost || card.manaCost,
			prices: selectedPrint
				? {
						usd: selectedPrint.price,
						usdFoil: selectedPrint.priceFoil,
						eur: card.prices?.eur ?? null,
						eurFoil: card.prices?.eurFoil ?? null,
						tix: card.prices?.tix ?? null
					}
				: card.prices,
			set: selectedPrint?.set || card.set,
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
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center"
		onclick={handleBackdropClick}
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
							{#each printings as print, index (print.id)}
								<button
									type="button"
									class="flex-shrink-0 rounded-lg border-2 p-1 text-left transition-colors {selectedPrintIndex ===
									index
										? 'border-accent bg-surface-card'
										: 'border-transparent hover:border-border-strong'}"
									onclick={() => selectPrinting(print, index)}
									aria-label="{print.setName} ({print.set}) #{print.collectorNumber}"
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
											{print.set}
										</p>
										<p class="text-[10px] text-text-muted">#{print.collectorNumber}</p>
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Condition -->
				<div>
					<span class="mb-2 block text-sm font-medium text-text-dim">Condition</span>
					<div class="grid grid-cols-4 gap-2">
						{#each CONDITIONS as cond}
							<button
								type="button"
								class="rounded-lg border px-3 py-2 text-sm transition-colors {condition ===
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
						class="flex items-center justify-between rounded-lg border border-border-strong p-3 text-sm transition-colors {isFoil
							? 'bg-accent-bg/10 text-accent border-accent'
							: 'text-text-dim hover:bg-surface-card'}"
						onclick={() => (isFoil = !isFoil)}
					>
						<span>Foil</span>
						<span
							class="flex h-5 w-5 items-center justify-center rounded-full {isFoil
								? 'bg-accent text-white'
								: 'bg-surface-card'}"
						>
							{#if isFoil}
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
						class="flex items-center justify-between rounded-lg border border-border-strong p-3 text-sm transition-colors {isSigned
							? 'bg-accent-bg/10 text-accent border-accent'
							: 'text-text-dim hover:bg-surface-card'}"
						onclick={() => (isSigned = !isSigned)}
					>
						<span>Signed</span>
						<span
							class="flex h-5 w-5 items-center justify-center rounded-full {isSigned
								? 'bg-accent text-white'
								: 'bg-surface-card'}"
						>
							{#if isSigned}
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

				<!-- Language -->
				<div>
					<span class="mb-2 block text-sm font-medium text-text-dim">Language</span>
					<select
						bind:value={language}
						class="w-full rounded-lg border border-border-strong bg-surface-card px-3 py-2 text-sm text-text-soft focus:border-accent/50 focus:ring-2 focus:ring-accent/50 focus:outline-none"
					>
						{#each LANGUAGES as lang}
							<option value={lang.value}>{lang.label}</option>
						{/each}
					</select>
				</div>

				<!-- Selected printing price preview -->
				{#if selectedPrint}
					<div class="rounded-lg border border-border bg-surface-card p-3">
						<div class="flex items-center justify-between text-sm">
							<span class="text-text-dim">{selectedPrint.setName} ({selectedPrint.set})</span>
							<span class="text-text-soft">{formatPrice(selectedPrint.price)}</span>
						</div>
						{#if selectedPrint.priceFoil}
							<div class="mt-1 flex items-center justify-between text-sm">
								<span class="text-text-muted">Foil</span>
								<span class="text-accent">{formatPrice(selectedPrint.priceFoil)}</span>
							</div>
						{/if}
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
