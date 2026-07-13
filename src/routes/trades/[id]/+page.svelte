<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getLocaleStore, t } from '$lib/i18n';

	interface OfferItem {
		user_card_id: string;
		quantity: number;
		side: 'offered' | 'requested';
		owner_id: string;
		card_name: string;
		set_code: string | null;
		collector_number: string | null;
		finish: string | null;
		condition: string;
		aftermarket_signed: boolean;
		is_altered: boolean;
		language: string | null;
		image_url: string | null;
	}

	interface Trade {
		id: string;
		status: string;
		proposer_id: string;
		recipient_id: string;
		proposer_username: string;
		recipient_username: string;
		current_offer_id: string;
		current_offer_offered_by: string;
		offer_note: string | null;
		offer_created_at: string;
		items: OfferItem[];
	}

	interface Stack {
		id: string;
		cardPrintingId: string;
		cardName: string;
		quantity: number;
		condition: string;
		finish: string | null;
		setCode: string | null;
		collectorNumber: string | null;
		imageUrl: string | null;
	}

	interface ApiCounterpartyStack {
		user_card_id: string;
		card_name: string;
		quantity: number;
		available_quantity?: number;
		condition: string;
		finish: string | null;
		set_code: string | null;
		collector_number: string | null;
		image_url: string | null;
	}

	interface ApiCollectionCard {
		id: string;
		cardPrintingId: string;
		cardName: string;
		quantity: number;
		condition: string;
		finish: string | null;
		setCode: string | null;
		collectorNumber: string | null;
		imageUrl: string | null;
	}

	interface BlockedUser {
		blocked_id: string;
	}

	const localeStore = getLocaleStore();
	const tradeId = $page.params.id;

	let trade = $state<Trade | null>(null);
	let currentUserId = $state<string | null>(null);
	let myStacks = $state<Stack[]>([]);
	let theirStacks = $state<Stack[]>([]);
	let isLoading = $state(true);
	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let showCounter = $state(false);
	let counterOffered = $state<Array<{ userCardId: string; quantity: number }>>([]);
	let counterRequested = $state<Array<{ userCardId: string; quantity: number }>>([]);
	let counterNote = $state('');
	let isBlocked = $state(false);
	let showRating = $state(false);
	let ratingValue = $state(5);
	let ratingComment = $state('');

	const otherUserId = $derived(
		trade ? (trade.proposer_id === currentUserId ? trade.recipient_id : trade.proposer_id) : null
	);

	const otherUserName = $derived(
		trade
			? trade.proposer_id === currentUserId
				? trade.recipient_username
				: trade.proposer_username
			: 'Unknown'
	);

	const myItems = $derived(trade?.items.filter((i) => i.owner_id === currentUserId) || []);
	const theirItems = $derived(trade?.items.filter((i) => i.owner_id !== currentUserId) || []);
	const canRespond = $derived(
		trade?.status === 'pending' && trade.current_offer_offered_by !== currentUserId
	);
	const canCounter = $derived(trade?.status === 'pending');

	function stackLabel(s: Stack) {
		const parts = [s.setCode, s.collectorNumber, s.finish, s.condition].filter(Boolean);
		return `${s.cardName}${parts.length ? ` (${parts.join(', ')})` : ''}`;
	}

	async function loadDetail() {
		isLoading = true;
		try {
			const res = await fetch(`/api/trades/${tradeId}`);
			const result = await res.json();
			if (result.success) {
				trade = result.data.trade as Trade;
				currentUserId = result.data.userId || null;
				theirStacks = ((result.data.counterpartyStacks as ApiCounterpartyStack[]) || []).map(
					(s) => ({
						id: s.user_card_id,
						cardPrintingId: s.user_card_id,
						cardName: s.card_name,
						quantity: s.available_quantity ?? s.quantity,
						condition: s.condition,
						finish: s.finish,
						setCode: s.set_code,
						collectorNumber: s.collector_number,
						imageUrl: s.image_url
					})
				);
				// Seed counter form from the current offer
				counterOffered = myItems.map((i) => ({ userCardId: i.user_card_id, quantity: i.quantity }));
				counterRequested = theirItems.map((i) => ({
					userCardId: i.user_card_id,
					quantity: i.quantity
				}));
			} else {
				message = { type: 'error', text: result.error?.message || 'Failed to load trade' };
			}
		} catch {
			message = { type: 'error', text: 'Failed to load trade' };
		} finally {
			isLoading = false;
		}
	}

	async function loadMyStacks() {
		try {
			const res = await fetch('/api/collection?game=mtg');
			const result = await res.json();
			if (result.success) {
				myStacks = ((result.data.cards as ApiCollectionCard[]) || []).map((c) => ({
					id: c.id,
					cardPrintingId: c.cardPrintingId,
					cardName: c.cardName,
					quantity: c.quantity,
					condition: c.condition,
					finish: c.finish,
					setCode: c.setCode,
					collectorNumber: c.collectorNumber,
					imageUrl: c.imageUrl
				}));
			}
		} catch (err) {
			console.error('Failed to load collection', err);
		}
	}

	async function loadBlocked() {
		try {
			const res = await fetch('/api/block');
			const result = await res.json();
			if (result.success && otherUserId) {
				isBlocked = ((result.data.blocked as BlockedUser[]) || []).some(
					(b) => b.blocked_id === otherUserId
				);
			}
		} catch (err) {
			console.error('Failed to load blocked users', err);
		}
	}

	async function toggleBlock() {
		if (!otherUserId) return;
		try {
			if (isBlocked) {
				const res = await fetch('/api/block', {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ blockedId: otherUserId })
				});
				const result = await res.json();
				if (result.success) {
					isBlocked = false;
					message = { type: 'success', text: 'Unblocked user' };
				} else {
					message = { type: 'error', text: result.error?.message || 'Failed to unblock' };
				}
			} else {
				const res = await fetch('/api/block', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ blockedId: otherUserId })
				});
				const result = await res.json();
				if (result.success) {
					isBlocked = true;
					message = { type: 'success', text: 'Blocked user' };
				} else {
					message = { type: 'error', text: result.error?.message || 'Failed to block' };
				}
			}
		} catch {
			message = { type: 'error', text: 'Failed to update block' };
		}
	}

	async function submitRating() {
		if (!otherUserId || !trade) return;
		try {
			const res = await fetch('/api/ratings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					tradeId: trade.id,
					ratedUserId: otherUserId,
					rating: ratingValue,
					comment: ratingComment || undefined
				})
			});
			const result = await res.json();
			if (result.success) {
				message = { type: 'success', text: 'Rating submitted' };
				showRating = false;
			} else {
				message = { type: 'error', text: result.error?.message || 'Failed to submit rating' };
			}
		} catch {
			message = { type: 'error', text: 'Failed to submit rating' };
		}
	}

	async function updateStatus(action: 'accept' | 'reject' | 'cancel') {
		try {
			const res = await fetch(`/api/trades/${tradeId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action })
			});
			const result = await res.json();
			if (result.success) {
				message = { type: 'success', text: `Trade ${action}ed` };
				await loadDetail();
			} else {
				message = { type: 'error', text: result.error?.message || 'Failed to update trade' };
			}
		} catch {
			message = { type: 'error', text: 'Failed to update trade' };
		}
	}

	function addOfferedStack() {
		counterOffered = [...counterOffered, { userCardId: '', quantity: 1 }];
	}

	function addRequestedStack() {
		counterRequested = [...counterRequested, { userCardId: '', quantity: 1 }];
	}

	function removeOffered(index: number) {
		counterOffered = counterOffered.filter((_, i) => i !== index);
	}

	function removeRequested(index: number) {
		counterRequested = counterRequested.filter((_, i) => i !== index);
	}

	async function submitCounter() {
		try {
			const res = await fetch(`/api/trades/${tradeId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'counter',
					offeredItems: counterOffered.filter((i) => i.userCardId && i.quantity > 0),
					requestedItems: counterRequested.filter((i) => i.userCardId && i.quantity > 0),
					note: counterNote || undefined
				})
			});
			const result = await res.json();
			if (result.success) {
				message = { type: 'success', text: 'Counter offer sent' };
				showCounter = false;
				await loadDetail();
			} else {
				message = { type: 'error', text: result.error?.message || 'Failed to send counter' };
			}
		} catch {
			message = { type: 'error', text: 'Failed to send counter' };
		}
	}

	onMount(() => {
		Promise.all([loadDetail(), loadMyStacks(), loadBlocked()]);
	});
</script>

<svelte:head>
	<title>Sylvan - {t($localeStore, 'trades.title')}</title>
</svelte:head>

<div class="mx-auto max-w-4xl p-6">
	<div class="mb-6 flex flex-wrap items-center gap-4">
		<button
			onclick={() => goto(resolve('/trades'))}
			class="rounded border border-border-strong px-3 py-1 text-sm text-text-dim hover:bg-surface-card"
		>
			← {t($localeStore, 'trades.myTrades')}
		</button>
		{#if otherUserId}
			<a
				href={resolve(`/users/${otherUserId}`)}
				class="text-2xl font-semibold tracking-tight text-accent hover:underline"
			>
				{t($localeStore, 'trades.tradeWith')}
				{otherUserName}
			</a>
		{:else}
			<h1 class="text-2xl font-semibold tracking-tight text-accent">
				{t($localeStore, 'trades.tradeWith')}
				{otherUserName}
			</h1>
		{/if}
		{#if otherUserId}
			<button
				onclick={toggleBlock}
				class="ml-auto rounded border border-border-strong px-3 py-1 text-sm {isBlocked
					? 'text-danger'
					: 'text-text-dim'} hover:bg-surface-card"
			>
				{isBlocked ? 'Unblock' : 'Block'}
			</button>
		{/if}
	</div>

	{#if message}
		<div
			class="mb-4 rounded-lg p-3 text-sm {message.type === 'success'
				? 'bg-emerald-900/20 text-accent'
				: 'bg-danger-bg text-danger'}"
		>
			{message.text}
		</div>
	{/if}

	{#if isLoading}
		<div class="flex h-40 items-center justify-center">
			<div
				class="animate-spin mb-3 inline-block h-8 w-8 rounded-full border-4 border-border-strong border-t-emerald-500"
			></div>
		</div>
	{:else if !trade}
		<p class="text-text-dim">Trade not found.</p>
	{:else}
		<div class="space-y-6">
			<div class="rounded-lg border border-border bg-surface-raised p-4">
				<div class="mb-2 flex items-center justify-between">
					<span class="text-sm text-text-muted">Status</span>
					<span
						class="rounded-full px-2 py-0.5 text-xs capitalize {trade.status === 'pending'
							? 'bg-yellow-900/20 text-yellow-400'
							: trade.status === 'accepted'
								? 'bg-emerald-900/20 text-accent'
								: 'bg-danger-bg text-danger'}">{trade.status}</span
					>
				</div>
				{#if trade.offer_note}
					<p class="text-sm text-text-soft">{trade.offer_note}</p>
				{/if}
				<p class="mt-2 text-xs text-text-dim">
					{t($localeStore, 'trades.created')}
					{new Date(trade.offer_created_at).toLocaleString()}
				</p>
			</div>

			<div class="grid gap-4 md:grid-cols-2">
				<div class="rounded-lg border border-border bg-surface-raised p-4">
					<h2 class="mb-3 text-sm font-medium uppercase text-text-dim">You give</h2>
					{#if myItems.length === 0}
						<p class="text-sm text-text-dim">Nothing yet.</p>
					{:else}
						<div class="space-y-2">
							{#each myItems as item (item.user_card_id)}
								<div class="flex items-center gap-3">
									{#if item.image_url}
										<img
											src={item.image_url}
											alt={item.card_name}
											class="h-12 w-8 rounded object-cover"
										/>
									{/if}
									<div class="text-sm">
										<p class="text-text">{item.quantity}x {item.card_name}</p>
										<p class="text-text-dim">
											{[item.set_code, item.collector_number, item.finish, item.condition]
												.filter(Boolean)
												.join(', ')}
										</p>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<div class="rounded-lg border border-border bg-surface-raised p-4">
					<h2 class="mb-3 text-sm font-medium uppercase text-text-dim">You receive</h2>
					{#if theirItems.length === 0}
						<p class="text-sm text-text-dim">Nothing yet.</p>
					{:else}
						<div class="space-y-2">
							{#each theirItems as item (item.user_card_id)}
								<div class="flex items-center gap-3">
									{#if item.image_url}
										<img
											src={item.image_url}
											alt={item.card_name}
											class="h-12 w-8 rounded object-cover"
										/>
									{/if}
									<div class="text-sm">
										<p class="text-text">{item.quantity}x {item.card_name}</p>
										<p class="text-text-dim">
											{[item.set_code, item.collector_number, item.finish, item.condition]
												.filter(Boolean)
												.join(', ')}
										</p>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			{#if trade.status === 'pending'}
				<div class="flex flex-wrap gap-3">
					{#if canRespond}
						<button
							onclick={() => updateStatus('accept')}
							class="rounded bg-accent-bg px-4 py-2 text-sm text-white hover:bg-accent-hover"
						>
							{t($localeStore, 'trades.accept')}
						</button>
						<button
							onclick={() => updateStatus('reject')}
							class="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-500"
						>
							{t($localeStore, 'trades.reject')}
						</button>
					{:else}
						<button
							onclick={() => updateStatus('cancel')}
							class="rounded border border-border-strong px-4 py-2 text-sm text-text-dim hover:bg-surface-card"
						>
							{t($localeStore, 'trades.cancel')}
						</button>
					{/if}
					{#if canCounter}
						<button
							onclick={() => (showCounter = !showCounter)}
							class="rounded border border-border-strong px-4 py-2 text-sm text-text-dim hover:bg-surface-card"
						>
							Counter
						</button>
					{/if}
				</div>
			{:else if trade.status === 'accepted'}
				<button
					onclick={() => (showRating = !showRating)}
					class="rounded bg-accent-bg px-4 py-2 text-sm text-white hover:bg-accent-hover"
				>
					Rate {otherUserName}
				</button>
			{/if}

			{#if showCounter}
				<form
					class="space-y-4 rounded-lg border border-border bg-surface-raised p-4"
					onsubmit={(e) => {
						e.preventDefault();
						submitCounter();
					}}
				>
					<h3 class="font-medium text-text">Counter offer</h3>

					<div>
						<h4 class="mb-2 text-sm font-medium text-text-soft">You give</h4>
						{#each counterOffered as row, idx (idx)}
							<div class="mb-2 flex items-center gap-2">
								<select
									bind:value={row.userCardId}
									class="flex-1 rounded border border-border-strong bg-surface-card px-2 py-1 text-sm text-text"
								>
									<option value="">Select a stack</option>
									{#each myStacks as stack (stack.id)}
										<option value={stack.id}>{stackLabel(stack)} (qty {stack.quantity})</option>
									{/each}
								</select>
								<input
									type="number"
									min="1"
									bind:value={row.quantity}
									class="w-20 rounded border border-border-strong bg-surface-card px-2 py-1 text-sm text-text"
								/>
								<button type="button" onclick={() => removeOffered(idx)} class="text-sm text-danger"
									>✕</button
								>
							</div>
						{/each}
						<button
							type="button"
							onclick={addOfferedStack}
							class="text-sm text-accent hover:underline">Add stack</button
						>
					</div>

					<div>
						<h4 class="mb-2 text-sm font-medium text-text-soft">You receive</h4>
						{#each counterRequested as row, idx (idx)}
							<div class="mb-2 flex items-center gap-2">
								<select
									bind:value={row.userCardId}
									class="flex-1 rounded border border-border-strong bg-surface-card px-2 py-1 text-sm text-text"
								>
									<option value="">Select a stack</option>
									{#each theirStacks as stack (stack.id)}
										<option value={stack.id}>{stackLabel(stack)} (avail {stack.quantity})</option>
									{/each}
								</select>
								<input
									type="number"
									min="1"
									bind:value={row.quantity}
									class="w-20 rounded border border-border-strong bg-surface-card px-2 py-1 text-sm text-text"
								/>
								<button
									type="button"
									onclick={() => removeRequested(idx)}
									class="text-sm text-danger">✕</button
								>
							</div>
						{/each}
						<button
							type="button"
							onclick={addRequestedStack}
							class="text-sm text-accent hover:underline">Add stack</button
						>
					</div>

					<div>
						<label class="mb-1 block text-xs text-text-dim" for="counter-note">Note</label>
						<textarea
							id="counter-note"
							bind:value={counterNote}
							class="w-full rounded border border-border-strong bg-surface-card px-3 py-2 text-sm text-text"
							rows="2"></textarea>
					</div>

					<div class="flex gap-3">
						<button
							type="submit"
							class="rounded bg-accent-bg px-4 py-2 text-sm text-white hover:bg-accent-hover"
						>
							Send counter
						</button>
						<button
							type="button"
							onclick={() => (showCounter = false)}
							class="rounded border border-border-strong px-4 py-2 text-sm text-text-dim hover:bg-surface-card"
						>
							Cancel
						</button>
					</div>
				</form>
			{/if}

			{#if showRating}
				<form
					class="space-y-4 rounded-lg border border-border bg-surface-raised p-4"
					onsubmit={(e) => {
						e.preventDefault();
						submitRating();
					}}
				>
					<h3 class="font-medium text-text">Rate {otherUserName}</h3>
					<div class="flex gap-2">
						{#each [1, 2, 3, 4, 5] as star (star)}
							<button
								type="button"
								onclick={() => (ratingValue = star)}
								class="text-2xl {star <= ratingValue ? 'text-yellow-400' : 'text-text-muted'}"
							>
								★
							</button>
						{/each}
					</div>
					<div>
						<label class="mb-1 block text-xs text-text-dim" for="rating-comment"
							>Comment (optional)</label
						>
						<textarea
							id="rating-comment"
							bind:value={ratingComment}
							class="w-full rounded border border-border-strong bg-surface-card px-3 py-2 text-sm text-text"
							rows="2"></textarea>
					</div>
					<div class="flex gap-3">
						<button
							type="submit"
							class="rounded bg-accent-bg px-4 py-2 text-sm text-white hover:bg-accent-hover"
						>
							Submit rating
						</button>
						<button
							type="button"
							onclick={() => (showRating = false)}
							class="rounded border border-border-strong px-4 py-2 text-sm text-text-dim hover:bg-surface-card"
						>
							Cancel
						</button>
					</div>
				</form>
			{/if}
		</div>
	{/if}
</div>
