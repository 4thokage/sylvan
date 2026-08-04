<script lang="ts" generics="T">
	import { getLocaleStore, t } from '$lib/i18n';

	export interface TableColumn<T> {
		key: string;
		label: string;
		align?: 'left' | 'right';
		sortValue?: (row: T) => string | number | null;
		render: (row: T) => string;
	}

	let {
		rows,
		columns,
		rowKey,
		onRowClick
	}: {
		rows: T[];
		columns: TableColumn<T>[];
		rowKey: (row: T) => string;
		onRowClick?: (row: T) => void;
	} = $props();

	let localeStore = getLocaleStore();
	let sortKey = $state<string | null>(null);
	let sortDir = $state<1 | -1>(1);

	let sorted = $derived.by(() => {
		const col = columns.find((c) => c.key === sortKey);
		if (!col?.sortValue) return rows;
		const dir = sortDir;
		return [...rows].sort((a, b) => {
			const va = col.sortValue!(a);
			const vb = col.sortValue!(b);
			if (va == null && vb == null) return 0;
			if (va == null) return 1;
			if (vb == null) return -1;
			if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
			return String(va).localeCompare(String(vb)) * dir;
		});
	});

	function toggleSort(key: string) {
		if (sortKey === key) {
			sortDir = sortDir === 1 ? -1 : 1;
		} else {
			sortKey = key;
			sortDir = 1;
		}
	}
</script>

<div class="overflow-x-auto rounded-lg border border-border">
	<table class="w-full min-w-max border-collapse text-sm">
		<thead>
			<tr class="border-b border-border bg-surface-raised text-left">
				{#each columns as col (col.key)}
					<th
						class="px-3 py-2 font-medium text-text-dim {col.align === 'right'
							? 'text-right'
							: 'text-left'}"
					>
						{#if col.sortValue}
							<button
								type="button"
								onclick={() => toggleSort(col.key)}
								class="inline-flex items-center gap-1 text-text-dim transition-colors hover:text-text"
							>
								{t($localeStore, col.label)}
								{#if sortKey === col.key}
									<span class="text-accent">{sortDir === 1 ? '▲' : '▼'}</span>
								{/if}
							</button>
						{:else}
							{t($localeStore, col.label)}
						{/if}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each sorted as row (rowKey(row))}
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<tr
					class="border-b border-border bg-surface-raised transition-colors {onRowClick
						? 'cursor-pointer hover:bg-surface-card'
						: ''}"
					onclick={onRowClick ? () => onRowClick(row) : undefined}
				>
					{#each columns as col (col.key)}
						<td class="px-3 py-2 text-text {col.align === 'right' ? 'text-right' : 'text-left'}">
							{col.render(row)}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
