<script lang="ts">
	import { getLocaleStore, t } from '$lib/i18n';

	let localeStore = getLocaleStore();
	let startingLife = $state(20);
	let life1 = $state(20);
	let life2 = $state(20);
	let history = $state<Array<{ player: number; life: number; timestamp: number }>>([]);

	function changeLife(player: number, delta: number) {
		if (player === 1) {
			life1 += delta;
			history = [...history, { player: 1, life: life1, timestamp: Date.now() }];
		} else {
			life2 += delta;
			history = [...history, { player: 2, life: life2, timestamp: Date.now() }];
		}
	}

	function reset() {
		life1 = startingLife;
		life2 = startingLife;
		history = [];
	}

	function undo() {
		if (history.length === 0) return;
		const last = history[history.length - 1];
		if (last.player === 1) {
			life1 =
				history.length > 1 && history[history.length - 2].player === 1
					? history[history.length - 2].life
					: startingLife;
		} else {
			life2 =
				history.length > 1 && history[history.length - 2].player === 2
					? history[history.length - 2].life
					: startingLife;
		}
		history = history.slice(0, -1);
	}
</script>

<svelte:head>
	<title>Sylvan - {t($localeStore, 'tools.life.title')}</title>
</svelte:head>

<div class="mx-auto max-w-3xl p-6">
	<h1 class="mb-2 text-2xl font-semibold">{t($localeStore, 'tools.life.title')}</h1>
	<p class="mb-6 text-text-muted">{t($localeStore, 'tools.life.description')}</p>

	<div class="mb-4 flex items-center gap-4">
		<label class="text-sm text-text-dim">{t($localeStore, 'tools.life.startingLife')}:</label>
		<input
			type="number"
			bind:value={startingLife}
			class="w-20 rounded-lg border border-border bg-surface-raised px-3 py-1 text-sm text-text focus:border-accent/50 focus:outline-none"
		/>
		<button
			onclick={reset}
			class="rounded-lg border border-border-strong px-3 py-1 text-sm text-text-soft transition-colors hover:bg-surface-card"
		>
			{t($localeStore, 'tools.life.reset')}
		</button>
		{#if history.length > 0}
			<button
				onclick={undo}
				class="rounded-lg border border-border-strong px-3 py-1 text-sm text-text-soft transition-colors hover:bg-surface-card"
			>
				Undo
			</button>
		{/if}
	</div>

	<div class="grid gap-6 sm:grid-cols-2">
		{#each [1, 2] as player (player)}
			<div class="rounded-xl border border-border bg-surface-raised p-6">
				<p class="text-sm text-text-muted text-center mb-2">
					{player === 1
						? t($localeStore, 'tools.life.player1')
						: t($localeStore, 'tools.life.player2')}
				</p>
				<p
					class="text-6xl font-bold text-center mb-4 {player === 1
						? 'text-blue-400'
						: 'text-rose-400'}"
				>
					{player === 1 ? life1 : life2}
				</p>
				<div class="flex justify-center gap-2">
					<button
						onclick={() => changeLife(player, -1)}
						class="h-12 w-12 rounded-lg border border-border-strong text-xl text-text-soft transition-colors hover:bg-surface-card"
					>
						−1
					</button>
					<button
						onclick={() => changeLife(player, -5)}
						class="h-12 w-12 rounded-lg border border-border-strong text-lg text-text-soft transition-colors hover:bg-surface-card"
					>
						−5
					</button>
					<button
						onclick={() => changeLife(player, 1)}
						class="h-12 w-12 rounded-lg border border-border-strong text-xl text-text-soft transition-colors hover:bg-surface-card"
					>
						+1
					</button>
					<button
						onclick={() => changeLife(player, 5)}
						class="h-12 w-12 rounded-lg border border-border-strong text-lg text-text-soft transition-colors hover:bg-surface-card"
					>
						+5
					</button>
				</div>
			</div>
		{/each}
	</div>
</div>
