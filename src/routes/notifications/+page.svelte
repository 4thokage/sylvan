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

	let notifications = $state<Notification[]>([]);
	let unreadCount = $state(0);
	let isLoading = $state(true);

	$effect(() => {
		loadNotifications();
	});

	async function loadNotifications() {
		isLoading = true;
		try {
			const res = await fetch('/api/notifications');
			const result = await res.json();
			if (result.success) {
				notifications = result.data.notifications || [];
				unreadCount = result.data.unreadCount || 0;
			}
		} catch {
			// ignore
		} finally {
			isLoading = false;
		}
	}

	async function markAllRead() {
		try {
			await fetch('/api/notifications', { method: 'PATCH' });
			notifications = notifications.map((n) => ({ ...n, read_at: new Date().toISOString() }));
			unreadCount = 0;
		} catch {
			// ignore
		}
	}
</script>

<svelte:head>
	<title>Sylvan - Notifications</title>
</svelte:head>

<div class="mx-auto max-w-7xl p-6">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight text-accent">Notifications</h1>
			<p class="mt-1 text-sm text-text-muted">{unreadCount} unread</p>
		</div>
		{#if unreadCount > 0}
			<button
				onclick={markAllRead}
				class="rounded-lg border border-border-strong px-3 py-2 text-sm text-text-soft hover:bg-surface-card"
			>
				Mark all read
			</button>
		{/if}
	</div>

	{#if isLoading}
		<div class="flex h-40 items-center justify-center">
			<div
				class="animate-spin mb-3 inline-block h-8 w-8 rounded-full border-4 border-border-strong border-t-emerald-500"
			></div>
		</div>
	{:else if notifications.length === 0}
		<div class="flex h-40 items-center justify-center">
			<p class="text-text-dim">No notifications yet</p>
		</div>
	{:else}
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
				</div>
			{/each}
		</div>
	{/if}
</div>
