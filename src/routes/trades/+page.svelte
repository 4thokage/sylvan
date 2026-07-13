<script lang="ts">
	import { onMount } from 'svelte';
	import { useClerkContext } from 'svelte-clerk';
	import { goto } from '$app/navigation';
	import { getLocaleStore, t } from '$lib/i18n';
	import { resolve } from '$app/paths';

	interface MatchedCard {
		name: string;
		qty: number;
		price: number;
		userCardId: string;
		finish: string | null;
		condition: string;
	}

	interface TradeMatch {
		wishlistId: string;
		wishlistOwner: string;
		userId: string | null;
		cardsYouHave: MatchedCard[];
		valueYouGive: number;
		score: number;
	}

	interface Trade {
		id: string;
		proposer_id: string;
		recipient_id: string;
		status: string;
		proposer_note: string | null;
		recipient_note: string | null;
		created_at: string;
		proposer: { id: string; username: string | null } | null;
		recipient: { id: string; username: string | null } | null;
	}

	let { data } = $props();
	let clerkCtx = useClerkContext();
	let localeStore = getLocaleStore();
	let currentUserId = $derived(clerkCtx.user?.id ?? data.user?.id ?? null);
	let isSignedIn = $derived(currentUserId !== null);
	let currentDbUserId = $state<string | null>(null);

	let tradeMatches = $state<TradeMatch[]>([]);
	let userTrades = $state<Trade[]>([]);
	let activeTab = $state<'suggestions' | 'active'>('suggestions');
	let isLoading = $state(true);
	let isLoadingTrades = $state(true);
	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	async function refreshTrades() {
		isLoading = true;
		try {
			const res = await fetch('/api/trades');
			const result = await res.json();
			if (result.success) {
				tradeMatches = result.data.matches || [];
				currentDbUserId = result.data.userId || null;
			}
		} catch (err) {
			console.error('Failed to refresh trades', err);
		} finally {
			isLoading = false;
		}
	}

	async function loadUserTrades() {
		if (!isSignedIn) {
			isLoadingTrades = false;
			return;
		}
		try {
			const res = await fetch('/api/trades');
			const result = await res.json();
			if (result.success) {
				userTrades = result.data.trades || [];
				currentDbUserId = result.data.userId || null;
			}
		} catch (err) {
			console.error('Failed to load user trades', err);
		} finally {
			isLoadingTrades = false;
		}
	}

	async function updateTradeStatus(tradeId: string, action: 'accept' | 'reject' | 'cancel') {
		try {
			const res = await fetch(`/api/trades/${tradeId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action })
			});
			const result = await res.json();
			if (result.success) {
				message = { type: 'success', text: `Trade ${action}ed!` };
				setTimeout(() => (message = null), 3000);
				await loadUserTrades();
			} else {
				message = { type: 'error', text: result.error?.message || 'Failed to update trade' };
			}
		} catch {
			message = { type: 'error', text: 'Failed to update trade' };
		}
	}

	function getOtherUser(trade: Trade): { id: string; username: string | null } | null {
		const isProposer = trade.proposer_id === currentDbUserId;
		return isProposer ? trade.recipient : trade.proposer;
	}

	function getOtherUserName(trade: Trade): string {
		return getOtherUser(trade)?.username || 'Unknown';
	}

	function getStatusBadge(status: string): string {
		switch (status) {
			case 'pending':
				return 'bg-yellow-900/20 text-yellow-400';
			case 'accepted':
				return 'bg-emerald-900/20 text-accent';
			case 'rejected':
				return 'bg-danger-bg text-danger';
			case 'cancelled':
				return 'bg-surface-card text-text-muted';
			default:
				return 'bg-surface-card text-text-muted';
		}
	}

	async function sendMessage(tradeId: string) {
		const text = prompt('Enter your message:');
		if (!text) return;
		const trade = userTrades.find((t) => t.id === tradeId);
		if (!trade) return;
		const isProposer = trade.proposer_id === currentDbUserId;
		const recipientId = isProposer ? trade.recipient_id : trade.proposer_id;
		try {
			const res = await fetch('/api/messages', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					recipientId,
					tradeId,
					body: text
				})
			});
			const result = await res.json();
			if (result.success) {
				message = { type: 'success', text: 'Message sent!' };
				setTimeout(() => (message = null), 3000);
			} else {
				message = { type: 'error', text: result.error?.message || 'Failed to send message' };
			}
		} catch {
			message = { type: 'error', text: 'Failed to send message' };
		}
	}

	async function proposeTrade(match: TradeMatch) {
		if (!match.userId) return;
		try {
			const res = await fetch('/api/trades', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					recipientId: match.userId,
					offeredItems: match.cardsYouHave.map((c) => ({
						userCardId: c.userCardId,
						quantity: c.qty
					})),
					requestedItems: []
				})
			});
			const result = await res.json();
			if (result.success) {
				message = { type: 'success', text: 'Trade proposal sent!' };
				setTimeout(() => (message = null), 3000);
				activeTab = 'active';
				await loadUserTrades();
			} else {
				message = { type: 'error', text: result.error?.message || 'Failed to propose trade' };
			}
		} catch {
			message = { type: 'error', text: 'Failed to propose trade' };
		}
	}

	onMount(async () => {
		await Promise.all([refreshTrades(), loadUserTrades()]);
	});
</script>

<svelte:head>
	<title>Sylvan - {t($localeStore, 'trades.title')}</title>
</svelte:head>

<div class="mx-auto max-w-4xl p-6">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight text-accent">
				{t($localeStore, 'trades.title')}
			</h1>
			<p class="mt-1 text-sm text-text-muted">{t($localeStore, 'trades.findUsers')}</p>
		</div>
		<button
			onclick={async () => {
				await Promise.all([refreshTrades(), loadUserTrades()]);
			}}
			disabled={isLoading || isLoadingTrades}
			class="rounded-lg bg-accent-bg px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
		>
			Refresh
		</button>
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

	<div class="mb-6 flex gap-1 rounded-lg bg-surface-raised p-1">
		<button
			onclick={() => (activeTab = 'suggestions')}
			class="flex-1 rounded-md py-2 text-sm font-medium transition-colors {activeTab ===
			'suggestions'
				? 'bg-accent-bg text-white'
				: 'text-text-dim hover:text-text'}"
		>
			{t($localeStore, 'trades.suggestions')}
		</button>
		<button
			onclick={() => (activeTab = 'active')}
			class="flex-1 rounded-md py-2 text-sm font-medium transition-colors {activeTab === 'active'
				? 'bg-accent-bg text-white'
				: 'text-text-dim hover:text-text'}"
		>
			{t($localeStore, 'trades.myTrades')}
			{userTrades.length > 0 ? `(${userTrades.length})` : ''}
		</button>
	</div>

	{#if activeTab === 'suggestions'}
		{#if !isSignedIn}
			<div class="mb-6 rounded-lg bg-yellow-900/20 p-4 text-sm text-yellow-400">
				{t($localeStore, 'trades.createWishlist')}
			</div>
		{/if}

		{#if isLoading && tradeMatches.length === 0}
			<div class="flex h-40 items-center justify-center">
				<div
					class="animate-spin mb-3 inline-block h-8 w-8 rounded-full border-4 border-border-strong border-t-emerald-500"
				></div>
			</div>
		{:else if tradeMatches.length === 0}
			<div class="flex h-40 items-center justify-center">
				<p class="text-text-dim">{t($localeStore, 'trades.noMatches')}</p>
			</div>
		{:else}
			<div class="space-y-4">
				{#each tradeMatches as match (match.wishlistId)}
					<div class="rounded-lg border border-border bg-surface-raised p-4">
						<div class="mb-3 flex items-center justify-between">
							<div>
								<h3 class="font-medium text-text">
									{match.wishlistOwner}{t($localeStore, 'trades.wishlistOf')}
								</h3>
								<a
									href={resolve(`/${match.wishlistId}`)}
									class="text-sm text-accent hover:underline"
								>
									{t($localeStore, 'trades.viewWishlist')} →
								</a>
							</div>
							<div class="text-right">
								<div class="text-sm font-medium text-accent">
									{t($localeStore, 'trades.match')}: {match.score}%
								</div>
							</div>
						</div>
						<div class="rounded bg-surface-card/50 p-3">
							<h4 class="mb-2 text-xs font-medium uppercase text-text-dim">
								{t($localeStore, 'trades.theyWant')}
							</h4>
							<div class="space-y-1">
								{#each match.cardsYouHave as card (card.userCardId)}
									<div class="flex justify-between text-sm">
										<span class="text-text-soft">
											{card.qty}x {card.name}
											{#if card.finish || card.condition}
												<span class="text-text-dim"
													>({[card.finish, card.condition].filter(Boolean).join(', ')})</span
												>
											{/if}
										</span>
									</div>
								{/each}
							</div>
						</div>
						{#if isSignedIn && match.userId}
							<button
								onclick={() => proposeTrade(match)}
								class="mt-3 w-full rounded bg-accent-bg py-2 text-sm text-white transition-colors hover:bg-accent-hover"
							>
								{t($localeStore, 'trades.propose')}
							</button>
						{:else if isSignedIn}
							<p class="mt-3 text-xs text-text-dim">{t($localeStore, 'trades.anonymousOwner')}</p>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	{:else}
		{#if isLoadingTrades}
			<div class="flex h-40 items-center justify-center">
				<div
					class="animate-spin mb-3 inline-block h-8 w-8 rounded-full border-4 border-border-strong border-t-emerald-500"
				></div>
			</div>
		{:else if userTrades.length === 0}
			<div class="flex h-40 items-center justify-center">
				<p class="text-text-dim">{t($localeStore, 'trades.noActiveTrades')}</p>
			</div>
		{:else}
			<div class="space-y-4">
				{#each userTrades as trade (trade.id)}
					<div class="rounded-lg border border-border bg-surface-raised p-4">
						<div class="mb-3 flex items-center justify-between">
							<div class="flex items-center gap-3">
								<span class="text-sm text-text-soft">
									{t($localeStore, 'trades.tradeWith')}
									<a
										href={resolve(`/users/${getOtherUser(trade)?.id}`)}
										class="font-medium text-text hover:text-accent hover:underline"
									>
										{getOtherUserName(trade)}
									</a>
								</span>
								<span class="rounded-full px-2 py-0.5 text-xs {getStatusBadge(trade.status)}">
									{trade.status}
								</span>
							</div>
							<div class="flex gap-2">
								<button
									onclick={() => sendMessage(trade.id)}
									class="rounded border border-border-strong px-2 py-1 text-xs text-text-dim hover:bg-surface-card"
								>
									{t($localeStore, 'trades.message')}
								</button>
								<button
									onclick={() => goto(resolve(`/trades/${trade.id}`))}
									class="rounded border border-border-strong px-2 py-1 text-xs text-text-dim hover:bg-surface-card"
								>
									View
								</button>
								{#if trade.status === 'pending' && trade.recipient_id === currentDbUserId}
									<button
										onclick={() => updateTradeStatus(trade.id, 'accept')}
										class="rounded bg-accent-bg px-3 py-1 text-xs text-white hover:bg-accent-hover"
									>
										{t($localeStore, 'trades.accept')}
									</button>
									<button
										onclick={() => updateTradeStatus(trade.id, 'reject')}
										class="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-500"
									>
										{t($localeStore, 'trades.reject')}
									</button>
								{:else if trade.status === 'pending' && trade.proposer_id === currentDbUserId}
									<button
										onclick={() => updateTradeStatus(trade.id, 'cancel')}
										class="rounded border border-border-strong px-3 py-1 text-xs text-text-dim hover:bg-surface-card"
									>
										{t($localeStore, 'trades.cancel')}
									</button>
								{/if}
							</div>
						</div>
						<div class="flex gap-4 text-xs text-text-muted">
							<span
								>{t($localeStore, 'trades.created')}
								{new Date(trade.created_at).toLocaleDateString()}</span
							>
							{#if trade.proposer_note}
								<span>{t($localeStore, 'trades.note')}: {trade.proposer_note}</span>
							{/if}
							{#if trade.recipient_note}
								<span>Counter: {trade.recipient_note}</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
