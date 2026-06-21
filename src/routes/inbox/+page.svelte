<script lang="ts">
	interface Notification {
		id: string;
		type: string;
		title: string;
		body: string | null;
		data: Record<string, unknown>;
		read_at: string | null;
		created_at: string;
	}

	interface Message {
		id: string;
		trade_id: string | null;
		body: string;
		read_at: string | null;
		created_at: string;
		sender: { id: string; username: string | null };
	}

	import { useClerkContext } from 'svelte-clerk';
	import { getLocaleStore, t } from '$lib/i18n';

	let { data } = $props();
	let clerkCtx = useClerkContext();
	let localeStore = getLocaleStore();
	let currentUserId = $derived(clerkCtx.user?.id ?? data.user?.id ?? null);

	let notifications = $state<Notification[]>([]);
	let messages = $state<Message[]>([]);
	let unreadCount = $state(0);
	let isLoading = $state(true);
	let activeTab = $state<'notifications' | 'messages'>('notifications');

	$effect(() => {
		loadInbox();
	});

	async function loadInbox() {
		isLoading = true;
		try {
			const [notifRes, msgRes] = await Promise.all([
				fetch('/api/notifications'),
				fetch('/api/messages')
			]);
			const notifResult = await notifRes.json();
			const msgResult = await msgRes.json();

			if (notifResult.success) {
				notifications = notifResult.data.notifications || [];
				unreadCount = notifResult.data.unreadCount || 0;
			}
			if (msgResult.success) {
				messages = msgResult.data.messages || [];
			}
		} catch {
			// ignore
		} finally {
			isLoading = false;
		}
	}

	async function markAllNotificationsRead() {
		try {
			await fetch('/api/notifications', { method: 'PATCH' });
			notifications = notifications.map((n) => ({ ...n, read_at: new Date().toISOString() }));
			unreadCount = 0;
		} catch {
			// ignore
		}
	}

	async function markMessageRead(msgId: string) {
		try {
			await fetch(`/api/messages/${msgId}`, { method: 'PATCH' });
			messages = messages.map((m) =>
				m.id === msgId ? { ...m, read_at: new Date().toISOString() } : m
			);
		} catch {
			// ignore
		}
	}

	function getSenderName(msg: Message): string {
		if (msg.sender.id === currentUserId) return 'You';
		return msg.sender.username || 'Unknown';
	}
</script>

<svelte:head>
	<title>Sylvan - {t($localeStore, 'inbox.title')}</title>
</svelte:head>

<div class="mx-auto max-w-7xl p-6">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight text-accent">
				{t($localeStore, 'inbox.title')}
			</h1>
			<p class="mt-1 text-sm text-text-muted">{unreadCount} {t($localeStore, 'inbox.unread')}</p>
		</div>
		<button
			onclick={loadInbox}
			class="rounded-lg border border-border-strong px-3 py-2 text-sm text-text-soft hover:bg-surface-card"
		>
			{t($localeStore, 'inbox.refresh')}
		</button>
	</div>

	<div class="mb-4 flex gap-2">
		<button
			onclick={() => (activeTab = 'notifications')}
			class="rounded-lg px-4 py-2 text-sm transition-colors {activeTab === 'notifications'
				? 'bg-accent-bg text-white'
				: 'border border-border-strong text-text-dim hover:bg-surface-card'}"
		>
			{t($localeStore, 'inbox.notifications')}
			{#if unreadCount > 0}
				<span class="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-xs text-white"
					>{unreadCount}</span
				>
			{/if}
		</button>
		<button
			onclick={() => (activeTab = 'messages')}
			class="rounded-lg px-4 py-2 text-sm transition-colors {activeTab === 'messages'
				? 'bg-accent-bg text-white'
				: 'border border-border-strong text-text-dim hover:bg-surface-card'}"
		>
			{t($localeStore, 'inbox.messages')}
		</button>
	</div>

	{#if isLoading}
		<div class="flex h-40 items-center justify-center">
			<div
				class="animate-spin mb-3 inline-block h-8 w-8 rounded-full border-4 border-border-strong border-t-emerald-500"
			></div>
		</div>
	{:else if activeTab === 'notifications'}
		{#if notifications.length === 0}
			<div class="flex h-40 items-center justify-center">
				<p class="text-text-dim">{t($localeStore, 'notifications.empty')}</p>
			</div>
		{:else}
			<div class="mb-4 flex justify-end">
				{#if unreadCount > 0}
					<button
						onclick={markAllNotificationsRead}
						class="rounded-lg border border-border-strong px-3 py-2 text-sm text-text-soft hover:bg-surface-card"
					>
						{t($localeStore, 'notifications.markAllRead')}
					</button>
				{/if}
			</div>
			<div class="space-y-2">
				{#each notifications as n (n.id)}
					<div
						class="rounded-lg border border-border bg-surface-raised p-4 {!n.read_at
							? 'border-l-2 border-l-emerald-500'
							: ''}"
					>
						<div class="flex items-start justify-between">
							<div>
								<h3 class="font-medium text-text">{n.title}</h3>
								{#if n.body}
									<p class="mt-1 text-sm text-text-dim">{n.body}</p>
								{/if}
							</div>
							<span class="text-xs text-text-muted"
								>{new Date(n.created_at).toLocaleDateString()}</span
							>
						</div>
						{#if n.data && (n.data as Record<string, unknown>).tradeId}
							<a href="/trades" class="mt-2 inline-block text-xs text-accent hover:underline">
								{t($localeStore, 'messages.viewTrade')} →
							</a>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	{:else if activeTab === 'messages'}
		{#if messages.length === 0}
			<div class="flex h-40 items-center justify-center">
				<p class="text-text-dim">{t($localeStore, 'messages.empty')}</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each messages as msg (msg.id)}
					<div
						class="rounded-lg border border-border bg-surface-raised p-4 {!msg.read_at &&
						msg.sender.id !== currentUserId
							? 'border-l-2 border-l-emerald-500'
							: ''}"
						onclick={() => !msg.read_at && markMessageRead(msg.id)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								!msg.read_at && markMessageRead(msg.id);
							}
						}}
						role="button"
						tabindex={0}
					>
						<div class="mb-1 flex items-center justify-between">
							<span class="text-sm font-medium text-text-soft">{getSenderName(msg)}</span>
							<span class="text-xs text-text-muted"
								>{new Date(msg.created_at).toLocaleString()}</span
							>
						</div>
						<p class="text-sm text-text-dim">{msg.body}</p>
						{#if msg.trade_id}
							<a href="/trades" class="mt-2 inline-block text-xs text-accent hover:underline">
								{t($localeStore, 'messages.viewTrade')} →
							</a>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
