export interface ParsedCard {
	name: string;
	qty: number;
	set?: string;
	collector_number?: string;
}

export interface ParsedLine {
	name: string;
	qty: number;
	set?: string;
	collector_number?: string;
	originalLine: string;
}

const ARENA_FORMAT_REGEX =
	/^(?<qty>\d+)\s+(?<name>.+?)\s*\((?<set>[A-Z0-9]+)\s*(?<collector_number>\d+)\)$/;
const STANDARD_FORMAT_REGEX = /^(?<qty>\d+)\s+(?<name>.+)$/;
const NAME_ONLY_REGEX = /^(?<name>.+)$/;

export function parseCardLine(line: string): ParsedLine | null {
	const trimmed = line.trim();
	if (!trimmed) return null;

	let match = trimmed.match(ARENA_FORMAT_REGEX);
	if (match?.groups) {
		return {
			qty: parseInt(match.groups.qty, 10),
			name: match.groups.name.trim(),
			set: match.groups.set,
			collector_number: match.groups.collector_number,
			originalLine: trimmed
		};
	}

	match = trimmed.match(STANDARD_FORMAT_REGEX);
	if (match?.groups) {
		return {
			qty: parseInt(match.groups.qty, 10),
			name: match.groups.name.trim(),
			originalLine: trimmed
		};
	}

	match = trimmed.match(NAME_ONLY_REGEX);
	if (match?.groups) {
		return {
			qty: 1,
			name: match.groups.name.trim(),
			originalLine: trimmed
		};
	}

	return null;
}

export function parseCardList(input: string): ParsedCard[] {
	const lines = input.split('\n').filter((line) => line.trim());
	const parsedLines = lines.map(parseCardLine).filter((l): l is ParsedLine => l !== null);

	const cardMap = new Map<string, ParsedCard>();

	for (const parsed of parsedLines) {
		const normalizedName = parsed.name.toLowerCase();
		const existing = cardMap.get(normalizedName);
		if (existing) {
			existing.qty += parsed.qty;
		} else {
			cardMap.set(normalizedName, {
				name: parsed.name,
				qty: parsed.qty,
				set: parsed.set,
				collector_number: parsed.collector_number
			});
		}
	}

	return Array.from(cardMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}
