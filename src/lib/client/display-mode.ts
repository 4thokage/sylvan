export type DisplayMode = 'visual' | 'table' | 'stacks';

const VALID_MODES: readonly string[] = ['visual', 'table', 'stacks'];

export function parseDisplayMode(
	raw: string | null | undefined,
	fallback: DisplayMode
): DisplayMode {
	if (raw && VALID_MODES.includes(raw)) {
		return raw as DisplayMode;
	}
	return fallback;
}

export function normalizeName(name: string): string {
	return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

export interface GroupableCard {
	cardId?: string | null;
	name: string;
}

export function groupByCardIdentity<T extends GroupableCard>(cards: T[]): T[][] {
	const groups = new Map<string, T[]>();
	for (const card of cards) {
		const key = card.cardId || normalizeName(card.name);
		const list = groups.get(key);
		if (list) {
			list.push(card);
		} else {
			groups.set(key, [card]);
		}
	}
	return Array.from(groups.values());
}

const CONDITION_LABELS: Record<string, string> = {
	NM: 'Near Mint',
	LP: 'Lightly Played',
	MP: 'Moderately Played',
	HP: 'Heavily Played',
	DMG: 'Damaged'
};

export function formatCondition(condition: string | null | undefined): string {
	if (!condition) return '';
	return CONDITION_LABELS[condition] ?? condition;
}

export function formatPrice(price: string | number | null | undefined, symbol = '$'): string {
	if (price == null) return '—';
	const p = typeof price === 'string' ? price.trim() : price;
	if (p === '') return '—';
	return `${symbol}${p}`;
}

export function priceToNumber(price: string | number | null | undefined): number | null {
	if (price == null) return null;
	const cleaned = typeof price === 'string' ? price.trim().replace(/[$€]/g, '') : price;
	if (cleaned === '') return null;
	const n = typeof cleaned === 'number' ? cleaned : parseFloat(cleaned);
	return Number.isNaN(n) ? null : n;
}
