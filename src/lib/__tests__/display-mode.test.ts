import { describe, it, expect } from 'vitest';
import {
	parseDisplayMode,
	normalizeName,
	groupByCardIdentity,
	formatCondition,
	formatPrice,
	priceToNumber
} from '../client/display-mode';

describe('parseDisplayMode', () => {
	it('returns the valid mode for recognized values', () => {
		expect(parseDisplayMode('visual', 'stacks')).toBe('visual');
		expect(parseDisplayMode('table', 'stacks')).toBe('table');
		expect(parseDisplayMode('stacks', 'stacks')).toBe('stacks');
	});

	it('falls back when null or undefined', () => {
		expect(parseDisplayMode(null, 'stacks')).toBe('stacks');
		expect(parseDisplayMode(undefined, 'visual')).toBe('visual');
	});

	it('falls back for unknown or empty values', () => {
		expect(parseDisplayMode('grid', 'stacks')).toBe('stacks');
		expect(parseDisplayMode('', 'visual')).toBe('visual');
	});
});

describe('normalizeName', () => {
	it('lowercases, trims, and collapses whitespace', () => {
		expect(normalizeName('  Lightning   BOLT ')).toBe('lightning bolt');
	});
});

describe('groupByCardIdentity', () => {
	it('groups by cardId when present', () => {
		const cards = [
			{ cardId: 'a', name: 'Lightning Bolt', qty: 4 },
			{ cardId: 'b', name: 'Counterspell', qty: 2 },
			{ cardId: 'a', name: 'Lightning Bolt', qty: 1 }
		];
		const groups = groupByCardIdentity(cards);
		expect(groups).toHaveLength(2);
		expect(groups[0]).toHaveLength(2);
		expect(groups[1]).toHaveLength(1);
	});

	it('falls back to normalized name when cardId is absent', () => {
		const cards = [
			{ cardId: null, name: 'Lightning Bolt', qty: 4 },
			{ name: 'lightning   bolt', qty: 1 }
		];
		const groups = groupByCardIdentity(cards);
		expect(groups).toHaveLength(1);
	});

	it('treats an empty-string cardId as absent', () => {
		const cards = [
			{ cardId: '', name: 'Lightning Bolt', qty: 4 },
			{ cardId: '', name: 'lightning bolt', qty: 1 },
			{ cardId: '', name: 'Counterspell', qty: 2 }
		];
		const groups = groupByCardIdentity(cards);
		expect(groups).toHaveLength(2);
	});

	it('keeps input order within groups', () => {
		const cards = [
			{ cardId: 'a', name: 'X', qty: 1 },
			{ cardId: 'b', name: 'Y', qty: 2 },
			{ cardId: 'a', name: 'X', qty: 3 }
		];
		const groups = groupByCardIdentity(cards);
		expect(groups[0].map((c) => c.qty)).toEqual([1, 3]);
		expect(groups[1].map((c) => c.qty)).toEqual([2]);
	});
});

describe('formatCondition', () => {
	it('maps known conditions and passes through unknown ones', () => {
		expect(formatCondition('NM')).toBe('Near Mint');
		expect(formatCondition('FOO')).toBe('FOO');
		expect(formatCondition(null)).toBe('');
	});
});

describe('formatPrice', () => {
	it('formats with the given symbol', () => {
		expect(formatPrice('12.50')).toBe('$12.50');
		expect(formatPrice(3, '€')).toBe('€3');
		expect(formatPrice(null)).toBe('—');
		expect(formatPrice('')).toBe('—');
	});

	it('trims surrounding whitespace and treats whitespace-only as missing', () => {
		expect(formatPrice('  12.50  ')).toBe('$12.50');
		expect(formatPrice('  ')).toBe('—');
	});
});

describe('priceToNumber', () => {
	it('parses numeric strings and handles empties', () => {
		expect(priceToNumber('12.50')).toBe(12.5);
		expect(priceToNumber(null)).toBeNull();
		expect(priceToNumber('')).toBeNull();
		expect(priceToNumber('abc')).toBeNull();
	});

	it('strips currency symbols and surrounding whitespace', () => {
		expect(priceToNumber('$12.50')).toBe(12.5);
		expect(priceToNumber('€ 3')).toBe(3);
		expect(priceToNumber('  4  ')).toBe(4);
		expect(priceToNumber('  ')).toBeNull();
	});
});
