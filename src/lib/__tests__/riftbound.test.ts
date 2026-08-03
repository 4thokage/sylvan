import { describe, it, expect, afterEach, vi } from 'vitest';
import { riftboundProvider } from '../api/providers/riftbound';

function mockCard(overrides: Record<string, unknown> = {}) {
	return {
		id: '69bc5beed308c64675ca89b3',
		name: 'Master Yi - Wuju Master',
		riftbound_id: 'unl-191-219',
		tcgplayer_id: '684620',
		collector_number: 191,
		attributes: { energy: null, might: null, power: null },
		classification: {
			type: 'Legend',
			supertype: null,
			rarity: 'Rare',
			domain: ['Calm', 'Body']
		},
		text: { rich: '<p>text</p>', plain: 'text', flavour: null },
		set: { set_id: 'UNL', label: 'Unleashed' },
		media: { image_url: 'https://example.com/card.png', artist: 'Artist', accessibility_text: '' },
		tags: ['Master Yi'],
		orientation: 'portrait',
		metadata: {
			clean_name: 'Master Yi Wuju Master',
			updated_on: '2026-07-10T22:45:05.556760+00:00',
			alternate_art: false,
			overnumbered: false,
			signature: false
		},
		...overrides
	};
}

function mockFetchOnce(body: unknown, ok = true, status = ok ? 200 : 404) {
	vi.stubGlobal(
		'fetch',
		vi.fn().mockResolvedValue({
			ok,
			status,
			headers: { get: () => null },
			json: vi.fn().mockResolvedValue(body)
		})
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('riftboundProvider.searchCards', () => {
	it('parses cards from the items envelope', async () => {
		mockFetchOnce({
			items: [mockCard()],
			total: 1,
			page: 1,
			size: 1,
			pages: 1
		});

		const result = await riftboundProvider.searchCards('master yi', 1);

		expect(result.cards).toHaveLength(1);
		expect(result.cards[0]).toMatchObject({
			name: 'Master Yi - Wuju Master',
			setCode: 'UNL',
			setName: 'Unleashed',
			collectorNumber: '191',
			rarity: 'Rare',
			language: 'en',
			finish: 'non-foil',
			gameSlug: 'riftbound'
		});
		expect(result.cards[0].externalRefs).toEqual([
			{ providerSlug: 'riftbound', identifierType: 'riftbound_id', externalId: 'unl-191-219' },
			{
				providerSlug: 'riftbound',
				identifierType: 'riftbound_card_id',
				externalId: '69bc5beed308c64675ca89b3'
			}
		]);
		expect(result.totalCount).toBe(1);
		expect(result.hasMore).toBe(false);
	});

	it('computes totalCount from items length when total is absent', async () => {
		mockFetchOnce({ items: [mockCard(), mockCard({ id: '2' })] });

		const result = await riftboundProvider.searchCards('master', 2);

		expect(result.cards).toHaveLength(2);
		expect(result.totalCount).toBe(2);
	});

	it('computes hasMore from page and pages', async () => {
		mockFetchOnce({
			items: [mockCard()],
			total: 10,
			page: 1,
			size: 2,
			pages: 5
		});

		const result = await riftboundProvider.searchCards('master', 2);

		expect(result.totalCount).toBe(10);
		expect(result.hasMore).toBe(true);
	});

	it('handles a bare array response', async () => {
		mockFetchOnce([mockCard()]);

		const result = await riftboundProvider.searchCards('master', 1);

		expect(result.cards).toHaveLength(1);
		expect(result.cards[0].name).toBe('Master Yi - Wuju Master');
		expect(result.totalCount).toBe(1);
	});

	it('returns an empty result for empty items', async () => {
		mockFetchOnce({ items: [], total: 0, page: 1, size: 50, pages: 0 });

		const result = await riftboundProvider.searchCards('zzzz', 50);

		expect(result.cards).toEqual([]);
		expect(result.totalCount).toBe(0);
		expect(result.hasMore).toBe(false);
	});

	it('returns an empty result on non-OK responses', async () => {
		mockFetchOnce({}, false);

		const result = await riftboundProvider.searchCards('master', 1);

		expect(result.cards).toEqual([]);
		expect(result.totalCount).toBe(0);
	});
});

describe('riftboundProvider.getCard', () => {
	it('maps the first item of the envelope', async () => {
		mockFetchOnce({ items: [mockCard()], total: 1, page: 1, size: 50, pages: 1 });

		const card = await riftboundProvider.getCard('master yi honed');

		expect(card).toMatchObject({
			name: 'Master Yi - Wuju Master',
			id: '69bc5beed308c64675ca89b3',
			setCode: 'UNL'
		});
	});

	it('returns null when the envelope has no items', async () => {
		mockFetchOnce({ items: [], total: 0, page: 1, size: 50, pages: 0 });

		const card = await riftboundProvider.getCard('no such card');

		expect(card).toBeNull();
	});

	it('returns null on non-OK responses', async () => {
		mockFetchOnce({}, false);

		const card = await riftboundProvider.getCard('master');

		expect(card).toBeNull();
	});
});
