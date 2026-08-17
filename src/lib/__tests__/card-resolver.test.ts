import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TcgCard } from '../api/providers/types';
import { resolveCards, resolvePrinting } from '../server/services/card-resolver.service';
import type { CardLookupResult } from '../server/services/card.service';

const h = vi.hoisted(() => ({
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	db: null as any,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	getCardsByIdentifiers: null as any,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	bulkEnsure: null as any
}));

vi.mock('$lib/server/supabase', () => ({
	getSupabase: () => h.db?.getSupabase()
}));

vi.mock('$lib/api/card-service', async (importOriginal) => {
	const mod = await importOriginal<typeof import('../api/card-service')>();
	return {
		...mod,
		getCardsByIdentifiers: (...args: unknown[]) => h.getCardsByIdentifiers?.(...args)
	};
});

vi.mock('../server/services/card.service', async (importOriginal) => {
	const mod = await importOriginal<typeof import('../server/services/card.service')>();
	return {
		...mod,
		bulkEnsureCardsAndPrintings: (...args: unknown[]) => h.bulkEnsure?.(...args)
	};
});

interface KnownCard {
	id: string;
	name: string;
	normalized_name: string;
	image_url: string | null;
	game_data: Record<string, unknown>;
	card_printings: Array<{
		id: string;
		set_code: string;
		set_name: string;
		collector_number: string;
		rarity: string;
		language: string;
		finish: string;
		factory_signed: boolean;
		image_url: string | null;
		market_price_usd: number | null;
		market_price_eur: number | null;
	}>;
}

function makeDb({
	knownCards = [],
	gameId = 'game-1'
}: {
	knownCards?: KnownCard[];
	gameId?: string | null;
}) {
	return {
		getSupabase() {
			let table = '';
			const chain = {
				from(t: string) {
					table = t;
					return chain;
				},
				select() {
					return chain;
				},
				eq() {
					return chain;
				},
				in() {
					return chain;
				},
				order() {
					return chain;
				},
				limit() {
					return chain;
				},
				range() {
					return chain;
				},
				async maybeSingle() {
					if (table === 'games') return { data: gameId ? { id: gameId } : null };
					return { data: knownCards[0] ?? null };
				},
				async single() {
					if (table === 'games') return { data: gameId ? { id: gameId } : null };
					return { data: knownCards[0] ?? null };
				},
				then(resolve: (value: unknown) => unknown) {
					const data = table === 'games' ? { id: gameId } : knownCards;
					return Promise.resolve({ data }).then(resolve);
				}
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} as any;
			return chain;
		}
	};
}

const blackLotus: KnownCard = {
	id: 'card-1',
	name: 'Black Lotus',
	normalized_name: 'black lotus',
	image_url: 'https://img/lotus.png',
	game_data: { type_line: 'Artifact' },
	card_printings: [
		{
			id: 'p1',
			set_code: 'LEA',
			set_name: 'Limited Edition Alpha',
			collector_number: '232',
			rarity: 'rare',
			language: 'en',
			finish: 'non-foil',
			factory_signed: false,
			image_url: 'https://img/lotus.png',
			market_price_usd: 100,
			market_price_eur: 90
		},
		{
			id: 'p2',
			set_code: 'LEA',
			set_name: 'Limited Edition Alpha',
			collector_number: '232',
			rarity: 'rare',
			language: 'en',
			finish: 'foil',
			factory_signed: false,
			image_url: 'https://img/lotus.png',
			market_price_usd: 200,
			market_price_eur: 180
		}
	]
};

const alphaDeathclaw: TcgCard = {
	id: 'x-1-non-foil',
	name: 'Alpha Deathclaw',
	normalizedName: 'alpha deathclaw',
	imageUrl: null,
	manaCost: null,
	typeLine: 'Creature',
	setCode: 'BLC',
	setName: 'Brotherhood',
	collectorNumber: '1',
	rarity: 'uncommon',
	language: 'en',
	finish: 'non-foil',
	factorySigned: false,
	prices: { usd: null, eur: null },
	externalRefs: [{ providerSlug: 'scryfall', identifierType: 'scryfall_id', externalId: 'x-1' }],
	gameSlug: 'mtg'
};

beforeEach(() => {
	h.db = makeDb({ knownCards: [blackLotus] });
	h.getCardsByIdentifiers = vi.fn().mockResolvedValue([alphaDeathclaw]);
	// The resolver batches all unknown cards into a single bulk upsert, returning
	// deterministic ids derived from each spec's position.
	h.bulkEnsure = vi
		.fn()
		.mockImplementation(
			async (
				_gameId: string,
				cardSpecs: Array<{ key: string }>,
				printingSpecs: Array<{ comboKey: string }>
			) => ({
				cards: new Map(cardSpecs.map((c, i) => [c.key, `card-${i + 2}`])),
				printings: new Map(printingSpecs.map((p, i) => [p.comboKey, `p-${i + 3}`]))
			})
		);
});

describe('resolveCards', () => {
	it('resolves known cards from the database without calling the provider', async () => {
		const { resolved, errors } = await resolveCards('mtg', [
			{ name: 'Black Lotus', qty: 2, finish: 'foil' }
		]);

		expect(errors).toEqual([]);
		expect(resolved).toHaveLength(1);
		expect(resolved[0]).toMatchObject({
			cardId: 'card-1',
			cardName: 'Black Lotus',
			printingId: 'p2',
			setCode: 'LEA',
			collectorNumber: '232',
			qty: 2,
			index: 0
		});
		expect(h.getCardsByIdentifiers).not.toHaveBeenCalled();
	});

	it('honors a client-supplied printing id over attribute matching', async () => {
		const { resolved } = await resolveCards('mtg', [
			{ name: 'Black Lotus', qty: 1, finish: 'foil', cardPrintingId: 'p1' }
		]);

		expect(resolved[0].printingId).toBe('p1');
	});

	it('resolves duplicate rows independently, preserving input order', async () => {
		const { resolved, errors } = await resolveCards('mtg', [
			{ name: 'Black Lotus', qty: 1, finish: 'non-foil' },
			{ name: 'Black Lotus', qty: 3, finish: 'foil' }
		]);

		expect(errors).toEqual([]);
		expect(resolved.map((r) => r.printingId)).toEqual(['p1', 'p2']);
		expect(resolved.map((r) => r.qty)).toEqual([1, 3]);
		expect(resolved.map((r) => r.index)).toEqual([0, 1]);
	});

	it('batches unknown cards through the provider and ensures them', async () => {
		h.db = makeDb({ knownCards: [] });

		const { resolved, errors } = await resolveCards('mtg', [{ name: 'Alpha Deathclaw', qty: 4 }]);

		expect(errors).toEqual([]);
		expect(h.getCardsByIdentifiers).toHaveBeenCalledTimes(1);
		expect(h.bulkEnsure).toHaveBeenCalledTimes(1);
		expect(resolved).toHaveLength(1);
		expect(resolved[0]).toMatchObject({
			cardId: 'card-2',
			printingId: 'p-3',
			qty: 4,
			index: 0
		});
	});

	it('keeps output order when mixing known and unknown cards', async () => {
		h.db = makeDb({ knownCards: [blackLotus] });

		const { resolved, errors } = await resolveCards('mtg', [
			{ name: 'Alpha Deathclaw', qty: 1 },
			{ name: 'Black Lotus', qty: 2 }
		]);

		expect(errors).toEqual([]);
		expect(resolved.map((r) => r.cardName)).toEqual(['Alpha Deathclaw', 'Black Lotus']);
		expect(resolved.map((r) => r.index)).toEqual([0, 1]);
	});

	it('reports every card as not found when the game is missing', async () => {
		h.db = makeDb({ knownCards: [blackLotus], gameId: null });

		const { resolved, errors } = await resolveCards('mtg', [
			{ name: 'Black Lotus', qty: 1 },
			{ name: 'Alpha Deathclaw', qty: 1 }
		]);

		expect(resolved).toEqual([]);
		expect(errors).toEqual(['Card not found: Black Lotus', 'Card not found: Alpha Deathclaw']);
		expect(h.getCardsByIdentifiers).not.toHaveBeenCalled();
	});

	it('reports errors for cards the provider cannot resolve', async () => {
		h.db = makeDb({ knownCards: [] });
		h.getCardsByIdentifiers = vi.fn().mockResolvedValue([]);

		const { resolved, errors } = await resolveCards('mtg', [
			{ name: 'Definitely Not A Real Card', qty: 1 }
		]);

		expect(resolved).toEqual([]);
		expect(errors).toEqual(['Card not found: Definitely Not A Real Card']);
	});
});

describe('resolvePrinting', () => {
	const lookup: CardLookupResult = {
		id: 'card-1',
		name: 'Black Lotus',
		normalizedName: 'black lotus',
		imageUrl: null,
		gameData: {},
		printings: [
			{
				id: 'p1',
				setCode: 'LEA',
				setName: 'Limited Edition Alpha',
				collectorNumber: '232',
				rarity: 'rare',
				imageUrl: null,
				language: 'en',
				finish: 'non-foil',
				factorySigned: false,
				marketPriceUsd: 100,
				marketPriceEur: 90
			},
			{
				id: 'p2',
				setCode: 'LEA',
				setName: 'Limited Edition Alpha',
				collectorNumber: '232',
				rarity: 'rare',
				imageUrl: null,
				language: 'en',
				finish: 'foil',
				factorySigned: false,
				marketPriceUsd: 200,
				marketPriceEur: 180
			}
		]
	};

	it('ignores a client-supplied id that is not a known printing uuid', () => {
		const id = resolvePrinting(lookup, {
			name: 'Black Lotus',
			qty: 1,
			cardPrintingId: 'x-1-foil'
		});
		expect(id).toBe('p1');
	});

	it('selects by finish when the printing id is unknown', () => {
		const id = resolvePrinting(lookup, { name: 'Black Lotus', qty: 1, finish: 'foil' });
		expect(id).toBe('p2');
	});
});
