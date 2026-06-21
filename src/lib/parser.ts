export interface ParsedCard {
	name: string;
	qty: number;
	set?: string;
	collector_number?: string;
}

const ARENA_REGEX = /^(?<qty>\d+)\s+(?<name>[^(]+)\s*\((?<set>[A-Z0-9]+)\)\s*(?<collector_number>\d+)$/;
const STANDARD_REGEX = /^(?<qty>\d+)\s+(?<name>.+)$/;

export function parseCardLine(line: string): { name: string; qty: number; set?: string; collector_number?: string } | null {
	const trimmed = line.trim();
	if (!trimmed) return null;

	// Skip sideboard markers: "SB: " or "Sideboard: "
	const clean = trimmed.replace(/^(SB:\s*|Sideboard:\s*)/i, '').trim();

	let match = clean.match(ARENA_REGEX);
	if (match?.groups) {
		return {
			qty: parseInt(match.groups.qty, 10),
			name: match.groups.name.trim(),
			set: match.groups.set,
			collector_number: match.groups.collector_number
		};
	}

	match = clean.match(STANDARD_REGEX);
	if (match?.groups) {
		return {
			qty: parseInt(match.groups.qty, 10),
			name: match.groups.name.trim()
		};
	}

	// Single card name (no quantity = 1)
	return {
		qty: 1,
		name: clean
	};
}

export function parseCardList(input: string): ParsedCard[] {
	const lines = input.split('\n').filter((line) => line.trim());
	const parsedLines = lines.map(parseCardLine).filter((l): l is ParsedCard => l !== null);

	const cardMap = new Map<string, ParsedCard>();

	for (const parsed of parsedLines) {
		const normalizedName = parsed.name.toLowerCase();
		const existing = cardMap.get(normalizedName);
		if (existing) {
			existing.qty += parsed.qty;
		} else {
			cardMap.set(normalizedName, { ...parsed });
		}
	}

	return Array.from(cardMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function parseCsv(text: string): ParsedCard[] {
	const lines = text.split('\n').filter((l) => l.trim());
	const cards = new Map<string, ParsedCard>();

	for (const line of lines) {
		const parts = line.split(',');
		if (parts.length < 1) continue;
		const name = parts[0].trim().replace(/^"(.*)"$/, '$1');
		const qty = parts.length > 1 ? parseInt(parts[1].trim(), 10) : 1;
		if (name && !isNaN(qty) && qty > 0) {
			const key = name.toLowerCase();
			const existing = cards.get(key);
			if (existing) {
				existing.qty += qty;
			} else {
				cards.set(key, { name, qty });
			}
		}
	}

	return Array.from(cards.values());
}

export function parseDeckbox(text: string): ParsedCard[] {
	const lines = text.split('\n').filter((l) => l.trim());
	const cards = new Map<string, ParsedCard>();
	let started = false;

	for (const line of lines) {
		if (line.toLowerCase().includes('name') && line.toLowerCase().includes('count')) {
			started = true;
			continue;
		}
		if (!started) continue;
		if (line.startsWith('---')) continue;

		const parts = line.split('\t');
		if (parts.length < 2) continue;
		const name = parts[0].trim();
		const qty = parseInt(parts[1].trim(), 10);
		if (name && !isNaN(qty) && qty > 0) {
			const key = name.toLowerCase();
			const existing = cards.get(key);
			if (existing) {
				existing.qty += qty;
			} else {
				cards.set(key, { name, qty });
			}
		}
	}

	return Array.from(cards.values());
}

export function cardsToText(cards: Array<{ name: string; qty: number }>): string {
	return cards.map((c) => `${c.qty} ${c.name}`).join('\n');
}

export function cardsToCsv(cards: Array<{ name: string; qty: number }>): string {
	return 'Name,Quantity\n' + cards.map((c) => `"${c.name}",${c.qty}`).join('\n');
}
