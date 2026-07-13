import Papa from 'papaparse';

export interface ParsedCard {
	name: string;
	qty: number;
	set?: string;
	collector_number?: string;
	condition?: string;
	foil?: boolean;
}

const ARENA_REGEX =
	/^(?<qty>\d+)\s+(?<name>[^(]+)\s*\((?<set>[A-Z0-9]+)\)\s*(?<collector_number>\d+)$/;
const STANDARD_REGEX = /^(?<qty>\d+)\s+(?<name>.+)$/;

export function parseCardLine(
	line: string
): { name: string; qty: number; set?: string; collector_number?: string } | null {
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

const FOIL_TRUE = new Set(['true', 'yes', '1', 'foil']);

function normalizeHeader(h: string): string {
	return h
		.toLowerCase()
		.trim()
		.replace(/[\s_]+/g, '');
}

function detectHeaderIndex(headers: string[], ...variants: string[]): number {
	for (let i = 0; i < headers.length; i++) {
		const normalized = normalizeHeader(headers[i]);
		for (const v of variants) {
			if (normalized === v) return i;
		}
	}
	return -1;
}

export function parseCsv(text: string): ParsedCard[] {
	const parsed = Papa.parse<string[]>(text.trim(), {
		skipEmptyLines: true,
		comments: '#'
	});

	if (parsed.data.length === 0) return [];

	const firstRow = parsed.data[0];
	const hasHeaders =
		firstRow.some((cell) => {
			const h = normalizeHeader(cell);
			return h === 'name' || h === 'quantity' || h === 'qty' || h === 'condition' || h === 'foil';
		}) &&
		!firstRow.some((cell) => {
			const h = normalizeHeader(cell);
			return h === '1' || h === '2' || h === '3' || h === '4';
		});

	const rows = hasHeaders ? parsed.data.slice(1) : parsed.data;
	const headers = hasHeaders ? firstRow : ['Name', 'Quantity'];

	const nameIdx = detectHeaderIndex(headers, 'name', 'cardname', 'card');
	const qtyIdx = detectHeaderIndex(headers, 'quantity', 'qty', 'count', 'amount');
	const setIdx = detectHeaderIndex(headers, 'set', 'setcode', 'edition');
	const cnIdx = detectHeaderIndex(headers, 'collectornumber', 'cn', 'number', 'num');
	const condIdx = detectHeaderIndex(headers, 'condition', 'cond', 'state');
	const foilIdx = detectHeaderIndex(headers, 'foil', 'isfoil', 'foil?');

	const cards = new Map<string, ParsedCard>();

	for (const row of rows) {
		const name = nameIdx >= 0 ? (row[nameIdx] || '').trim() : '';
		const qtyRaw = qtyIdx >= 0 ? (row[qtyIdx] || '').trim() : '';
		const qty = qtyRaw ? parseInt(qtyRaw, 10) : 1;

		if (!name || isNaN(qty) || qty <= 0) continue;

		const set = setIdx >= 0 ? (row[setIdx] || '').trim() || undefined : undefined;
		const collector_number = cnIdx >= 0 ? (row[cnIdx] || '').trim() || undefined : undefined;
		const condition = condIdx >= 0 ? (row[condIdx] || '').trim() || undefined : undefined;
		const foil = foilIdx >= 0 ? FOIL_TRUE.has((row[foilIdx] || '').toLowerCase().trim()) : false;

		const key = name.toLowerCase();
		const existing = cards.get(key);
		if (existing) {
			existing.qty += qty;
		} else {
			cards.set(key, { name, qty, set, collector_number, condition, foil });
		}
	}

	return Array.from(cards.values());
}

export function parseTcgplayerCsv(text: string): ParsedCard[] {
	const parsed = Papa.parse<Record<string, string>>(text.trim(), {
		header: true,
		skipEmptyLines: true,
		comments: '#'
	});

	const rows = parsed.data || [];
	const headers = parsed.meta.fields || [];
	if (rows.length === 0 || headers.length === 0) return [];

	const nameIdx = detectHeaderIndex(headers, 'name', 'cardname', 'card', 'productname', 'product');
	const qtyIdx = detectHeaderIndex(headers, 'quantity', 'qty', 'count', 'amount');
	const setIdx = detectHeaderIndex(headers, 'set', 'setcode', 'edition', 'setname');
	const cnIdx = detectHeaderIndex(headers, 'collectornumber', 'cn', 'number', 'num', 'collector');
	const condIdx = detectHeaderIndex(headers, 'condition', 'cond', 'state');
	const foilIdx = detectHeaderIndex(headers, 'foil', 'isfoil', 'finish', 'foil?');

	if (nameIdx < 0 || qtyIdx < 0) return [];

	const cards = new Map<string, ParsedCard>();

	for (const row of rows) {
		const name = (row[headers[nameIdx]] || '').trim();
		const qtyRaw = (row[headers[qtyIdx]] || '').trim();
		const qty = qtyRaw ? parseInt(qtyRaw, 10) : 1;

		if (!name || isNaN(qty) || qty <= 0) continue;

		const set = setIdx >= 0 ? (row[headers[setIdx]] || '').trim() || undefined : undefined;
		const collector_number = cnIdx >= 0 ? (row[headers[cnIdx]] || '').trim() || undefined : undefined;
		const condition = condIdx >= 0 ? (row[headers[condIdx]] || '').trim() || undefined : undefined;
		const foil = foilIdx >= 0 ? FOIL_TRUE.has((row[headers[foilIdx]] || '').toLowerCase().trim()) : false;

		const key = name.toLowerCase();
		const existing = cards.get(key);
		if (existing) {
			existing.qty += qty;
		} else {
			cards.set(key, { name, qty, set, collector_number, condition, foil });
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
