<script lang="ts">
	let { data } = $props();

	interface AdminData {
		users: Array<{ id: string; display_name: string | null; username: string | null; is_public: boolean; is_admin: boolean; created_at: string }>;
		trades: Array<{ id: string; status: string; created_at: string }>;
		stats: {
			totalUsers: number;
			totalTrades: number;
			totalCollectionCards: number;
			tradesByStatus: Record<string, number>;
		};
	}

	let adminData = $state<AdminData | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	$effect(() => {
		loadAdminData();
	});

	async function loadAdminData() {
		isLoading = true;
		error = null;
		try {
			const res = await fetch('/api/admin');
			const result = await res.json();
			if (result.success) {
				adminData = result.data;
			} else {
				error = result.error?.message || 'Failed to load admin data';
			}
		} catch {
			error = 'Failed to load admin data';
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Sylvan - Admin Panel</title>
</svelte:head>

<div class="mx-auto max-w-7xl p-6">
	<h1 class="mb-6 text-2xl font-semibold tracking-tight text-accent">Admin Panel</h1>

	{#if isLoading}
		<div class="flex h-40 items-center justify-center">
			<div class="animate-spin mb-3 inline-block h-8 w-8 rounded-full border-4 border-border-strong border-t-emerald-500"></div>
		</div>
	{:else if error}
		<div class="rounded-lg bg-danger-bg p-4 text-sm text-danger">{error}</div>
	{:else if adminData}
		<div class="grid gap-6 md:grid-cols-4">
			<div class="rounded-lg border border-border bg-surface-raised p-4">
				<p class="text-2xl font-bold text-text">{adminData.stats.totalUsers}</p>
				<p class="text-sm text-text-muted">Users</p>
			</div>
			<div class="rounded-lg border border-border bg-surface-raised p-4">
				<p class="text-2xl font-bold text-text">{adminData.stats.totalTrades}</p>
				<p class="text-sm text-text-muted">Trades</p>
			</div>
			<div class="rounded-lg border border-border bg-surface-raised p-4">
				<p class="text-2xl font-bold text-text">{adminData.stats.totalCollectionCards}</p>
				<p class="text-sm text-text-muted">Collection Cards</p>
			</div>
			<div class="rounded-lg border border-border bg-surface-raised p-4">
				<div class="space-y-1">
					{#each Object.entries(adminData.stats.tradesByStatus) as [status, count]}
						<div class="flex justify-between text-sm">
							<span class="text-text-dim">{status}</span>
							<span class="font-medium text-text">{count}</span>
						</div>
					{/each}
				</div>
				<p class="mt-2 text-xs text-text-muted">Trade Statuses</p>
			</div>
		</div>

		<div class="mt-8 grid gap-8 lg:grid-cols-2">
			<div>
				<h2 class="mb-4 text-lg font-medium text-text-soft">Recent Users</h2>
				<div class="space-y-2">
					{#each adminData.users as u}
						<div class="rounded border border-border bg-surface-raised/50 p-3 text-sm">
							<div class="flex items-center justify-between">
								<span class="text-text-soft">{u.display_name || u.username || 'Unknown'}</span>
								<div class="flex gap-2">
									{#if u.is_admin}<span class="text-xs text-accent">Admin</span>{/if}
									{#if u.is_public}<span class="text-xs text-text-muted">Public</span>{/if}
								</div>
							</div>
							<p class="text-xs text-text-muted">{new Date(u.created_at).toLocaleDateString()}</p>
						</div>
					{/each}
				</div>
			</div>
			<div>
				<h2 class="mb-4 text-lg font-medium text-text-soft">Recent Trades</h2>
				<div class="space-y-2">
					{#each adminData.trades as t}
						<div class="rounded border border-border bg-surface-raised/50 p-3 text-sm">
							<div class="flex items-center justify-between">
								<span class="font-mono text-xs text-text-dim">{t.id.slice(0, 8)}...</span>
								<span class="rounded-full px-2 py-0.5 text-xs bg-surface-card text-text-dim">{t.status}</span>
							</div>
							<p class="text-xs text-text-muted">{new Date(t.created_at).toLocaleDateString()}</p>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>
