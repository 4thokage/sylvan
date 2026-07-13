import type { TcgProvider, TcgCard, TcgPrinting, TcgExternalRef } from './types';

const API_BASE = 'https://api.scryfall.com';
const MAX_BATCH = 75;
const RATE_LIMIT_MS = 100;

interface ScryfallCard {
	id: string;
	name: string;
	mana_cost: string | null;
	cmc: number | null;
	type_line: string | null;
	oracle_id: string | null;
	image_uris: {
		small: string;
		normal: string;
		large: string;
		png: string;
		art_crop: string;
		border_crop: string;
	} | null;
	card_faces?: Array<{
		name: string;
		mana_cost: string | null;
		image_uris: {
			small: string;
			normal: string;
			large: string;
			png: string;
			art_crop: string;
			border_crop: string;
		};
	}>;
	set: string;
	set_name: string;
	collector_number: string;
	rarity: string;
	lang: string;
	prices: {
		usd: string | null;
		usd_foil: string | null;
		usd_etched: string | null;
		eur: string | null;
		eur_foil: string | null;
		tix: string | null;
	};
	released_at: string;
}

const HEADERS = {
	'Content-Type': 'application/json',
	Accept: 'application/json',
	'User-Agent': 'SylvanApp/1.0 (contact@sylvan.app)'
};

async function delay(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}

function extractImageUrl(raw: ScryfallCard): string | null {
	return raw.image_uris?.normal || raw.card_faces?.[0]?.image_uris?.normal || null;
}

function extractManaCost(raw: ScryfallCard): string | null {
	return raw.mana_cost || raw.card_faces?.[0]?.mana_cost || null;
}

function normalizeName(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/['"]/g, '')
		.replace(/[-\s]+/g, ' ');
}

function buildCardRefs(raw: ScryfallCard): TcgExternalRef[] {
	const refs: TcgExternalRef[] = [];
	if (raw.oracle_id) {
		refs.push({
			providerSlug: 'scryfall',
			identifierType: 'oracle_id',
			externalId: raw.oracle_id
		});
	}
	refs.push({
		providerSlug: 'scryfall',
		identifierType: 'scryfall_id',
		externalId: raw.id
	});
	return refs;
}

function mapToTcgCard(
	raw: ScryfallCard,
	finish: string,
	priceUsd: string | null,
	priceEur: string | null
): TcgCard {
	return {
		id: `${raw.id}-${finish}`,
		name: raw.name,
		normalizedName: normalizeName(raw.name),
		imageUrl: extractImageUrl(raw),
		manaCost: extractManaCost(raw),
		typeLine: raw.type_line || null,
		setCode: raw.set,
		setName: raw.set_name,
		collectorNumber: raw.collector_number,
		rarity: raw.rarity,
		language: raw.lang || 'en',
		finish,
		factorySigned: false,
		prices: {
			usd: priceUsd,
			eur: priceEur
		},
		externalRefs: buildCardRefs(raw),
		gameSlug: 'mtg'
	};
}

function cardToPrinting(
	raw: ScryfallCard,
	finish: string,
	priceUsd: string | null,
	priceEur: string | null
): TcgPrinting {
	return {
		id: `${raw.id}-${finish}`,
		setCode: raw.set,
		setName: raw.set_name,
		collectorNumber: raw.collector_number,
		rarity: raw.rarity,
		imageUrl: extractImageUrl(raw),
		manaCost: extractManaCost(raw),
		language: raw.lang || 'en',
		finish,
		factorySigned: false,
		price: priceUsd,
		priceEur: priceEur,
		releasedAt: raw.released_at || null,
		externalRefs: buildCardRefs(raw)
	};
}

function* splitFinishes(raw: ScryfallCard): Generator<TcgCard> {
	const p = raw.prices || {};
	const hasNonFoil = p.usd !== null && p.usd !== undefined;
	const hasFoil = p.usd_foil !== null && p.usd_foil !== undefined;
	const hasEtched = p.usd_etched !== null && p.usd_etched !== undefined;

	if (hasNonFoil) {
		yield mapToTcgCard(raw, 'non-foil', p.usd, p.eur);
	}
	if (hasFoil) {
		yield mapToTcgCard(raw, 'foil', p.usd_foil, p.eur_foil);
	}
	if (hasEtched) {
		yield mapToTcgCard(raw, 'foil-etched', p.usd_etched, null);
	}
	// If a printing has no price data at all, still emit a non-foil placeholder so it can be stored.
	if (!hasNonFoil && !hasFoil && !hasEtched) {
		yield mapToTcgCard(raw, 'non-foil', null, null);
	}
}

function* splitPrintings(raw: ScryfallCard): Generator<TcgPrinting> {
	const p = raw.prices || {};
	const hasNonFoil = p.usd !== null && p.usd !== undefined;
	const hasFoil = p.usd_foil !== null && p.usd_foil !== undefined;
	const hasEtched = p.usd_etched !== null && p.usd_etched !== undefined;

	if (hasNonFoil) {
		yield cardToPrinting(raw, 'non-foil', p.usd, p.eur);
	}
	if (hasFoil) {
		yield cardToPrinting(raw, 'foil', p.usd_foil, p.eur_foil);
	}
	if (hasEtched) {
		yield cardToPrinting(raw, 'foil-etched', p.usd_etched, null);
	}
	if (!hasNonFoil && !hasFoil && !hasEtched) {
		yield cardToPrinting(raw, 'non-foil', null, null);
	}
}

export const scryfallProvider: TcgProvider = {
	gameSlug: 'mtg',
	gameName: 'Magic: The Gathering',

	normalizeName,

	async searchCards(
		query: string,
		limit = 25
	): Promise<{ cards: TcgCard[]; totalCount: number; hasMore: boolean }> {
		await delay(RATE_LIMIT_MS);
		const response = await fetch(
			`${API_BASE}/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=released&dir=desc`,
			{ headers: HEADERS }
		);

		if (response.status === 404) {
			return { cards: [], totalCount: 0, hasMore: false };
		}

		if (!response.ok) {
			throw new Error(`Scryfall search failed: ${response.status}`);
		}

		const data = await response.json();
		const allCards: TcgCard[] = [];
		for (const raw of (data.data || []).slice(0, limit)) {
			for (const card of splitFinishes(raw)) {
				allCards.push(card);
			}
		}

		return { cards: allCards, totalCount: data.total_cards || 0, hasMore: data.has_more || false };
	},

	async fuzzySearchCard(name: string): Promise<TcgCard | null> {
		await delay(RATE_LIMIT_MS);
		const url = `${API_BASE}/cards/named?fuzzy=${encodeURIComponent(name)}`;

		const response = await fetch(url, { headers: HEADERS });
		if (response.status === 404) return null;
		if (!response.ok) throw new Error(`Scryfall fuzzy lookup failed: ${response.status}`);
		const card = await response.json();
		const variants = Array.from(splitFinishes(card));
		return variants[0] || null;
	},

	async getCard(name: string, set?: string, collectorNumber?: string): Promise<TcgCard | null> {
		await delay(RATE_LIMIT_MS);
		let url = `${API_BASE}/cards/named?exact=${encodeURIComponent(name)}`;
		if (set && collectorNumber) {
			url = `${API_BASE}/cards/${set.toLowerCase()}/${collectorNumber}`;
		} else if (set) {
			url = `${API_BASE}/cards/named?exact=${encodeURIComponent(name)}&set=${set.toLowerCase()}`;
		}

		const response = await fetch(url, { headers: HEADERS });
		if (response.status === 404) return null;
		if (!response.ok) throw new Error(`Scryfall lookup failed: ${response.status}`);
		const card = await response.json();
		const variants = Array.from(splitFinishes(card));
		return variants[0] || null;
	},

	async getCardsByIdentifiers(
		identifiers: Array<{ name: string; set?: string; collectorNumber?: string }>
	): Promise<TcgCard[]> {
		const allCards: TcgCard[] = [];

		for (let i = 0; i < identifiers.length; i += MAX_BATCH) {
			const batch = identifiers.slice(i, i + MAX_BATCH);
			await delay(RATE_LIMIT_MS);

			const response = await fetch(`${API_BASE}/cards/collection`, {
				method: 'POST',
				headers: HEADERS,
				body: JSON.stringify({
					identifiers: batch.map((id) => ({
						name: id.name,
						...(id.set && { set: id.set.toLowerCase() }),
						...(id.collectorNumber && { collector_number: id.collectorNumber })
					}))
				})
			});

			if (!response.ok) {
				if (response.status === 429) throw new Error('Rate limited by Scryfall API');
				throw new Error(`Scryfall collection failed: ${response.status}`);
			}

			const data = await response.json();
			for (const raw of data.data || []) {
				for (const card of splitFinishes(raw)) {
					allCards.push(card);
				}
			}
		}

		return allCards;
	},

	async getAllPrintings(cardName: string): Promise<TcgPrinting[]> {
		const prints: TcgPrinting[] = [];
		let page = 1;
		let hasMore = true;

		while (hasMore) {
			await delay(RATE_LIMIT_MS);
			const response = await fetch(
				`${API_BASE}/cards/search?q=${encodeURIComponent(cardName)}&unique=prints&order=released&dir=desc&page=${page}`,
				{ headers: HEADERS }
			);

			if (!response.ok) {
				if (response.status === 429) throw new Error('Rate limited by Scryfall API');
				throw new Error(`Scryfall printings failed: ${response.status}`);
			}

			const data = await response.json();
			for (const raw of data.data || []) {
				for (const printing of splitPrintings(raw)) {
					prints.push(printing);
				}
			}

			hasMore = data.has_more || false;
			page++;
		}

		return prints;
	}
};
