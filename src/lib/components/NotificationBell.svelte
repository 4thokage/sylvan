<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { useClerkContext } from 'svelte-clerk';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { supabase } from '$lib/supabase-client';

	interface Notification {
		id: string;
		type: string;
		payload: Record<string, unknown>;
		read_at: string | null;
		created_at: string;
	}

	const clerkCtx = useClerkContext();
	const isSignedIn = $derived(!!clerkCtx.user);

	let notifications = $state<Notification[]>([]);
	let unreadCount = $state(0);
	let userDbId = $state<string | null>(null);
	let open = $state(false);
	let pollTimer: ReturnType<typeof setInterval> | null = null;
	let channel: ReturnType<typeof supabase.channel> | null = null;

	async function fetchNotifications() {
		if (!isSignedIn) return;
		try {
			const res = await fetch('/api/notifications');
			const result = await res.json();
			if (result.success) {
				notifications = result.data.notifications || [];
				unreadCount = result.data.unreadCount || 0;
				userDbId = result.data.userId || userDbId;
			}
		} catch (err) {
			console.error('Failed to fetch notifications', err);
		}
	}

	async function markAllRead() {
		try {
			const res = await fetch('/api/notifications', { method: 'PATCH' });
			const result = await res.json();
			if (result.success) {
				notifications = notifications.map((n) => ({
					...n,
					read_at: n.read_at || new Date().toISOString()
				}));
				unreadCount = 0;
			}
		} catch (err) {
			console.error('Failed to mark notifications read', err);
		}
	}

	function handleNotification(n: Notification) {
		if (n.type.startsWith('trade_')) {
			const tradeId = n.payload.trade_id;
			if (typeof tradeId === 'string') goto(resolve(`/trades/${tradeId}`));
		} else if (n.type === 'message') {
			goto(resolve('/inbox'));
		}
		open = false;
	}

	async function startRealtime() {
		if (!isSignedIn || !userDbId) return;
		try {
			const token = await clerkCtx.session?.getToken();
			if (token) {
				supabase.realtime.setAuth(token);
			}
		} catch {
			// Fall back to polling if auth fails.
		}

		channel = supabase
			.channel('notifications')
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'notifications',
					filter: `user_id=eq.${userDbId}`
				},
				(payload) => {
					const n = payload.new as Notification;
					notifications = [n, ...notifications];
					if (!n.read_at) unreadCount += 1;
				}
			)
			.subscribe();
	}

	onMount(() => {
		fetchNotifications();
		pollTimer = setInterval(fetchNotifications, 30000);
		startRealtime();
	});

	onDestroy(() => {
		if (pollTimer) clearInterval(pollTimer);
		if (channel) supabase.removeChannel(channel);
	});
</script>

{#if isSignedIn}
	<div class="relative">
		<button
			onclick={() => (open = !open)}
			class="relative rounded p-2 text-text-dim hover:bg-surface-card hover:text-text"
			aria-label="Notifications"
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
				/>
			</svg>
			{#if unreadCount > 0}
				<span
					class="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white"
				>
					{unreadCount > 9 ? '9+' : unreadCount}
				</span>
			{/if}
		</button>

		{#if open}
			<div
				class="absolute right-0 top-full mt-2 w-80 rounded-lg border border-border bg-surface-raised shadow-xl"
			>
				<div class="flex items-center justify-between border-b border-border px-4 py-2">
					<span class="text-sm font-medium text-text">Notifications</span>
					<button onclick={markAllRead} class="text-xs text-accent hover:underline">
						Mark all read
					</button>
				</div>
				<div class="max-h-80 overflow-y-auto">
					{#if notifications.length === 0}
						<p class="px-4 py-6 text-center text-sm text-text-dim">No notifications yet.</p>
					{:else}
						{#each notifications as n (n.id)}
							<button
								onclick={() => handleNotification(n)}
								class="w-full px-4 py-3 text-left hover:bg-surface-card {n.read_at
									? 'opacity-60'
									: ''}"
							>
								<p class="text-sm text-text">
									{#if n.type === 'trade_offer'}
										New trade offer
									{:else if n.type === 'trade_accepted'}
										Trade accepted
									{:else if n.type === 'trade_rejected'}
										Trade rejected
									{:else if n.type === 'trade_cancelled'}
										Trade cancelled
									{:else if n.type === 'message'}
										New message
									{:else}
										{n.type}
									{/if}
								</p>
								<p class="text-xs text-text-dim">{new Date(n.created_at).toLocaleString()}</p>
							</button>
						{/each}
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}
