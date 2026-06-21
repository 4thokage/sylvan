<script lang="ts">
	import ScannerView from '$lib/components/ScannerView.svelte';
	import { scannedCards } from '$lib/scanner/store';
	import type { ScannedCard } from '$lib/scanner/types';

	import { useClerkContext } from 'svelte-clerk';

	let { data } = $props();
	let clerkCtx = useClerkContext();
	let currentUserId = $derived(clerkCtx.user?.id ?? data.user?.id ?? null);
	let isSignedIn = $derived(currentUserId !== null);

	let detectedCardsValue = $state<ScannedCard[]>([]);
	let isSaving = $state(false);
	let saveMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	$effect(() => {
		detectedCardsValue = $scannedCards;
	});

	async function saveToCollection() {
		if (!currentUserId || detectedCardsValue.length === 0 || isSaving) return;

		isSaving = true;
		saveMessage = null;

		try {
			const cardsToSave = detectedCardsValue.map((card) => ({
				name: card.name,
				qty: card.qty
			}));

			const response = await fetch('/api/collection/merge', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ cards: cardsToSave })
			});

			const result = await response.json();
			if (result.success) {
				saveMessage = { type: 'success', text: 'Saved to collection!' };
				setTimeout(() => (saveMessage = null), 3000);
			} else {
				saveMessage = { type: 'error', text: result.error?.message || 'Failed to save' };
			}
		} catch {
			saveMessage = { type: 'error', text: 'Failed to save to collection' };
		} finally {
			isSaving = false;
		}
	}

	function handleCardsChange(cards: ScannedCard[]) {
		detectedCardsValue = cards;
	}
</script>

<svelte:head>
	<title>Sylvan - Card Scanner</title>
	<meta name="description" content="Scan cards with your camera" />
</svelte:head>

<div class="flex h-[calc(100vh-73px)] flex-col">
	<div class="flex-1">
		<ScannerView onCardsChange={handleCardsChange} />
	</div>

	{#if detectedCardsValue.length > 0}
		<div class="border-t border-border bg-surface-raised p-4">
			<div class="mx-auto flex max-w-7xl items-center justify-between">
				<div class="flex items-center gap-4">
					<div class="flex items-center gap-2">
						<span class="font-medium text-white">
							{detectedCardsValue.reduce((sum, c) => sum + c.qty, 0)} cards
						</span>
						<span class="text-sm text-text-muted">
							({detectedCardsValue.length} unique)
						</span>
					</div>
				</div>

				<div class="flex items-center gap-3">
					{#if saveMessage}
						<span class="text-sm {saveMessage.type === 'success' ? 'text-accent' : 'text-danger'}">
							{saveMessage.text}
						</span>
					{/if}

					{#if isSignedIn}
						<button
							onclick={saveToCollection}
							disabled={isSaving}
							class="flex items-center gap-2 rounded-lg bg-accent-bg px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-hover"
						>
							<span>Save to Collection</span>
						</button>
					{:else}
						<span class="text-sm text-text-muted">Sign in to save</span>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
