<script lang="ts">
	interface Message {
		id: string;
		trade_id: string | null;
		body: string;
		read_at: string | null;
		created_at: string;
		sender: { id: string; display_name: string | null; username: string | null };
	}

	import { useClerkContext } from 'svelte-clerk';

	let { data } = $props();
	let clerkCtx = useClerkContext();
	let currentUserId = $derived(clerkCtx.user?.id ?? data.user?.id ?? null);
	let messages = $state<Message[]>([]);
	let isLoading = $state(true);
	let selectedTradeId = $state<string | null>(null);

	$effect(() => {
		loadMessages();
	});

	async function loadMessages() {
		isLoading = true;
		try {
			const params = selectedTradeId ? `?tradeId=${selectedTradeId}` : '';
			const res = await fetch(`/api/messages${params}`);
			const result = await res.json();
			if (result.success) {
				messages = result.data.messages || [];
			}
		} catch {
			// ignore
		} finally {
			isLoading = false;
		}
	}

	function getOtherName(msg: Message): string {
		if (msg.sender.id === currentUserId) return 'You';
		return msg.sender.display_name || msg.sender.username || 'Unknown';
	}

	async function markRead(msgId: string) {
		try {
			await fetch(`/api/messages/${msgId}`, { method: 'PATCH' });
			messages = messages.map((m) =>
				m.id === msgId ? { ...m, read_at: new Date().toISOString() } : m
			);
		} catch {
			// ignore
		}
	}
</script>

<svelte:head>
	<title>Sylvan - Messages</title>
</svelte:head>

<div class="mx-auto max-w-7xl p-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-semibold tracking-tight text-accent">Messages</h1>
		<button
			onclick={loadMessages}
			class="rounded-lg border border-border-strong px-3 py-2 text-sm text-text-soft hover:bg-surface-card"
		>
			Refresh
		</button>
	</div>

	{#if isLoading}
		<div class="flex h-40 items-center justify-center">
			<div
				class="animate-spin mb-3 inline-block h-8 w-8 rounded-full border-4 border-border-strong border-t-emerald-500"
			></div>
		</div>
	{:else if messages.length === 0}
		<div class="flex h-40 items-center justify-center">
			<p class="text-text-dim">No messages yet</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each messages as msg (msg.id)}
				<div
					class="rounded-lg border border-border bg-surface-raised p-4 {!msg.read_at &&
					msg.sender.id !== currentUserId
						? 'border-l-2 border-l-emerald-500'
						: ''}"
					onclick={() => !msg.read_at && markRead(msg.id)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							!msg.read_at && markRead(msg.id);
						}
					}}
					role="button"
					tabindex={0}
				>
					<div class="mb-1 flex items-center justify-between">
						<span class="text-sm font-medium text-text-soft">{getOtherName(msg)}</span>
						<span class="text-xs text-text-muted">{new Date(msg.created_at).toLocaleString()}</span>
					</div>
					<p class="text-sm text-text-dim">{msg.body}</p>
					{#if msg.trade_id}
						<a href="/trades" class="mt-2 inline-block text-xs text-accent hover:underline">
							View trade →
						</a>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
