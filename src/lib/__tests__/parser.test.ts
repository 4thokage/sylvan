import { describe, it, expect } from 'vitest';
import { parseCardList, parseCsv, parseDeckbox, cardsToText, cardsToCsv } from '../parser';

describe('parseCardList', () => {
	it('parses single card with quantity', () => {
		const result = parseCardList('4 Lightning Bolt');
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ name: 'Lightning Bolt', qty: 4 });
	});

	it('parses multiple cards', () => {
		const result = parseCardList('4 Lightning Bolt\n2 Counterspell');
		expect(result).toHaveLength(2);
		expect(result[0]).toMatchObject({ name: 'Counterspell', qty: 2 });
		expect(result[1]).toMatchObject({ name: 'Lightning Bolt', qty: 4 });
	});

	it('merges duplicate cards', () => {
		const result = parseCardList('4 Lightning Bolt\n2 Lightning Bolt');
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ name: 'Lightning Bolt', qty: 6 });
	});

	it('handles MTG Arena format', () => {
		const result = parseCardList('4 Lightning Bolt (M10) 123');
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			name: 'Lightning Bolt',
			qty: 4,
			set: 'M10',
			collector_number: '123'
		});
	});

	it('skips sideboard markers', () => {
		const result = parseCardList('SB: 1 Platinum Angel');
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ name: 'Platinum Angel', qty: 1 });
	});

	it('returns empty for empty input', () => {
		expect(parseCardList('')).toHaveLength(0);
		expect(parseCardList('\n\n')).toHaveLength(0);
	});
});

describe('parseCsv', () => {
	it('parses CSV format', () => {
		const result = parseCsv('"Lightning Bolt",4\n"Counterspell",2');
		expect(result).toHaveLength(2);
		expect(result[0]).toMatchObject({ name: 'Lightning Bolt', qty: 4 });
	});

	it('handles quotes in CSV', () => {
		const result = parseCsv('"Birds of Paradise",1');
		expect(result[0]).toMatchObject({ name: 'Birds of Paradise', qty: 1 });
	});
});

describe('parseDeckbox', () => {
	it('parses Deckbox tab-separated format', () => {
		const input = 'Name\tCount\nLightning Bolt\t4\nCounterspell\t2';
		const result = parseDeckbox(input);
		expect(result).toHaveLength(2);
		expect(result[0]).toMatchObject({ name: 'Lightning Bolt', qty: 4 });
	});

	it('skips header row', () => {
		const result = parseDeckbox('Name\tCount\nSol Ring\t1\n');
		expect(result).toHaveLength(1);
	});
});

describe('cardsToText', () => {
	it('converts cards to text format', () => {
		const result = cardsToText([{ name: 'Lightning Bolt', qty: 4 }]);
		expect(result).toBe('4 Lightning Bolt');
	});
});

describe('cardsToCsv', () => {
	it('converts cards to CSV format', () => {
		const result = cardsToCsv([{ name: 'Lightning Bolt', qty: 4 }]);
		expect(result).toBe('Name,Quantity\n"Lightning Bolt",4');
	});
});
