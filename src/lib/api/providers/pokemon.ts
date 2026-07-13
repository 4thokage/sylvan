/* eslint-disable @typescript-eslint/no-explicit-any */
import TCGdex, { Query } from '@tcgdex/sdk';
import type { TcgProvider, TcgCard, TcgPrinting, TcgExternalRef } from './types';

const tcgdex = new TCGdex('en');

interface PokemonVariants {
	normal?: boolean;
	holo?: boolean;
	reverseHolo?: boolean;
	firstEdition?: boolean;
}

interface RawCard {
	id: string;
	localId: string;
	name: string;
	image?: string;
	set?: { id: string; name: string };
	rarity?: string;
	category?: string;
	variants?: PokemonVariants;
}

function normalize(rawName: string): string {
	return rawName
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '')
		.replace(/[-\s]+/g, ' ');
}

function buildRefs(raw: RawCard): TcgExternalRef[] {
	return [
		{
			providerSlug: 'tcgdex',
			identifierType: 'tcgdex_id',
			externalId: raw.id
		}
	];
}

function imageUrl(raw: any): string | null {
	if (typeof raw.getImageURL === 'function') {
		return raw.getImageURL('high', 'png');
	}
	if (raw.image) {
		return `https://images.tcgdex.net/${tcgdex.getLang()}/high/${raw.id}.png`;
	}
	return null;
}

function mapToTcgCard(raw: any, finish: string, idSuffix = ''): TcgCard {
	const name = raw.name || '';
	return {
		id: `${raw.id}-${finish}${idSuffix ? `-${idSuffix}` : ''}`,
		name,
		normalizedName: normalize(name),
		imageUrl: imageUrl(raw),
		manaCost: null,
		typeLine: raw.category || null,
		setCode: raw.set?.id || (raw.id?.split('-')[0] ?? ''),
		setName: raw.set?.name || '',
		collectorNumber: raw.localId || raw.id?.split('-')[1] || '',
		rarity: raw.rarity || '',
		language: tcgdex.getLang(),
		finish,
		factorySigned: false,
		prices: { usd: null, eur: null },
		externalRefs: buildRefs(raw),
		gameSlug: 'pokemon'
	};
}

function cardToPrinting(raw: any, finish: string, idSuffix = ''): TcgPrinting {
	const full = mapToTcgCard(raw, finish, idSuffix);
	return {
		id: full.id,
		setCode: full.setCode,
		setName: full.setName,
		collectorNumber: full.collectorNumber,
		rarity: full.rarity,
		imageUrl: full.imageUrl,
		manaCost: null,
		language: full.language,
		finish,
		factorySigned: false,
		price: null,
		priceEur: null,
		releasedAt: null,
		externalRefs: full.externalRefs
	};
}

function* splitFinishes(raw: any): Generator<TcgCard> {
	const variants: PokemonVariants = raw.variants || {};
	const hasVariant =
		variants.normal || variants.holo || variants.reverseHolo || variants.firstEdition;

	if (!hasVariant) {
		yield mapToTcgCard(raw, 'non-foil');
		return;
	}

	if (variants.normal) yield mapToTcgCard(raw, 'non-foil');
	if (variants.holo) yield mapToTcgCard(raw, 'holo');
	if (variants.reverseHolo) yield mapToTcgCard(raw, 'reverse-holo');
	if (variants.firstEdition) yield mapToTcgCard(raw, 'non-foil', 'first-edition');
}

function* splitPrintings(raw: any): Generator<TcgPrinting> {
	const variants: PokemonVariants = raw.variants || {};
	const hasVariant =
		variants.normal || variants.holo || variants.reverseHolo || variants.firstEdition;

	if (!hasVariant) {
		yield cardToPrinting(raw, 'non-foil');
		return;
	}

	if (variants.normal) yield cardToPrinting(raw, 'non-foil');
	if (variants.holo) yield cardToPrinting(raw, 'holo');
	if (variants.reverseHolo) yield cardToPrinting(raw, 'reverse-holo');
	if (variants.firstEdition) yield cardToPrinting(raw, 'non-foil', 'first-edition');
}

async function getFullCard(raw: any): Promise<any> {
	if (typeof raw.getCard === 'function') {
		return raw.getCard();
	}
	return raw;
}

export const pokemonProvider: TcgProvider = {
	gameSlug: 'pokemon',
	gameName: 'Pokémon TCG',

	normalizeName: normalize,

	async searchCards(
		query: string,
		limit = 25
	): Promise<{ cards: TcgCard[]; totalCount: number; hasMore: boolean }> {
		const q = Query.create()
			.contains('name', query)
			.sort('set.releaseDate', 'DESC')
			.paginate(1, limit);
		const results = await tcgdex.card.list(q);
		const cards: TcgCard[] = [];
		for (const r of results.slice(0, limit)) {
			const full = await getFullCard(r);
			for (const card of splitFinishes(full)) {
				cards.push(card);
			}
		}
		return { cards, totalCount: results.length, hasMore: false };
	},

	async fuzzySearchCard(name: string): Promise<TcgCard | null> {
		return this.getCard(name);
	},

	async getCard(name: string, set?: string, collectorNumber?: string): Promise<TcgCard | null> {
		if (set && collectorNumber) {
			const id = `${set.toLowerCase()}-${collectorNumber}`;
			const card = await tcgdex.card.get(id);
			if (card) {
				const full = await getFullCard(card);
				const variants = Array.from(splitFinishes(full));
				return variants[0] || null;
			}
		}
		let q = Query.create().equal('name', name).paginate(1, 1);
		let results = await tcgdex.card.list(q);
		if (results.length === 0) {
			q = Query.create().contains('name', name).paginate(1, 1);
			results = await tcgdex.card.list(q);
		}
		if (results.length === 0) return null;
		const full = await getFullCard(results[0]);
		const variants = Array.from(splitFinishes(full));
		return variants[0] || null;
	},

	async getCardsByIdentifiers(
		identifiers: Array<{ name: string; set?: string; collectorNumber?: string }>
	): Promise<TcgCard[]> {
		const cards: TcgCard[] = [];
		for (const id of identifiers) {
			const card = await this.getCard(id.name, id.set, id.collectorNumber);
			if (card) cards.push(card);
		}
		return cards;
	},

	async getAllPrintings(cardName: string): Promise<TcgPrinting[]> {
		let q = Query.create().equal('name', cardName).sort('set.releaseDate', 'DESC');
		let results = await tcgdex.card.list(q);
		if (results.length === 0) {
			q = Query.create().contains('name', cardName).sort('set.releaseDate', 'DESC');
			results = await tcgdex.card.list(q);
		}
		const printings: TcgPrinting[] = [];
		for (const r of results) {
			const full = await getFullCard(r);
			for (const printing of splitPrintings(full)) {
				printings.push(printing);
			}
		}
		return printings;
	}
};
