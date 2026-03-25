export interface ScryfallCard {
	object: 'card';
	id: string;
	name: string;
	mana_cost: string | null;
	cmc: number | null;
	type_line: string | null;
	oracle_text: string | null;
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
		object: 'card_face';
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
	prices: {
		usd: string | null;
		usd_foil: string | null;
		usd_etched: string | null;
		eur: string | null;
		eur_foil: string | null;
		tix: string | null;
	};
	purchase_uris?: {
		tcgplayer?: string;
		cardmarket?: string;
	};
}

export interface ScryfallCollectionResponse {
	object: 'list';
	total_cards: number;
	not_found: Array<{
		object: 'card_identifier';
		id?: string;
		mtgo_id?: number;
		multiverse_id?: number;
		oracle_id?: string;
		illustration_id?: string;
		name?: string;
		set?: string;
		collector_number?: string;
	}>;
	data: ScryfallCard[];
}

export interface CardPrices {
	usd: string | null;
	usdFoil: string | null;
	eur: string | null;
	eurFoil: string | null;
	tix: string | null;
}

export interface CardPrint {
	name: string;
	set: string;
	setName: string;
	price: string | null;
	priceFoil: string | null;
	imageUrl: string | null;
}

export interface WishlistCard {
	name: string;
	qty: number;
	imageUrl: string | null;
	manaCost: string | null;
	prices?: CardPrices;
	oracleId?: string;
	printings?: CardPrint[];
}

export interface CardIdentifier {
	id?: string;
	mtgo_id?: number;
	multiverse_id?: number;
	oracle_id?: string;
	illustration_id?: string;
	name?: string;
	set?: string;
	collector_number?: string;
}

const SCRYFALL_API_URL = 'https://api.scryfall.com';
const MAX_BATCH_SIZE = 75;
const RATE_LIMIT_DELAY_MS = 100;

export async function fetchCardsByIdentifiers(
	identifiers: CardIdentifier[]
): Promise<{ cards: ScryfallCard[]; notFound: CardIdentifier[] }> {
	if (identifiers.length === 0) {
		return { cards: [], notFound: [] };
	}

	const batches: CardIdentifier[][] = [];
	for (let i = 0; i < identifiers.length; i += MAX_BATCH_SIZE) {
		batches.push(identifiers.slice(i, i + MAX_BATCH_SIZE));
	}

	const allCards: ScryfallCard[] = [];
	const allNotFound: CardIdentifier[] = [];

	for (const batch of batches) {
		await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));

		try {
			const response = await fetch(`${SCRYFALL_API_URL}/cards/collection`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json'
				},
				body: JSON.stringify({ identifiers: batch })
			});

			if (!response.ok) {
				if (response.status === 429) {
					throw new Error('Rate limited by Scryfall API. Please try again in a moment.');
				}
				throw new Error(`Scryfall API error: ${response.status} ${response.statusText}`);
			}

			const data: ScryfallCollectionResponse = await response.json();

			allCards.push(...data.data);

			if (data.not_found && data.not_found.length > 0) {
				for (const notFound of data.not_found) {
					const identifier: CardIdentifier = {};
					if (notFound.id) identifier.id = notFound.id;
					if (notFound.mtgo_id) identifier.mtgo_id = notFound.mtgo_id;
					if (notFound.multiverse_id) identifier.multiverse_id = notFound.multiverse_id;
					if (notFound.oracle_id) identifier.oracle_id = notFound.oracle_id;
					if (notFound.illustration_id) identifier.illustration_id = notFound.illustration_id;
					if (notFound.name) identifier.name = notFound.name;
					if (notFound.set) identifier.set = notFound.set;
					if (notFound.collector_number) identifier.collector_number = notFound.collector_number;
					allNotFound.push(identifier);
				}
			}
		} catch (err) {
			console.error('[ScryfallClient] Error fetching batch:', err);
			throw err;
		}
	}

	return { cards: allCards, notFound: allNotFound };
}

export function convertToWishlistCards(
	parsedCards: Array<{ name: string; qty: number; set?: string; collector_number?: string }>,
	scryfallCards: ScryfallCard[]
): WishlistCard[] {
	const cardMap = new Map<string, ScryfallCard>();

	for (const card of scryfallCards) {
		cardMap.set(card.name.toLowerCase(), card);
	}

	return parsedCards.map((parsed) => {
		const normalizedName = parsed.name.toLowerCase();
		const scryfallCard = cardMap.get(normalizedName);

		if (scryfallCard) {
			const imageUrl =
				scryfallCard.image_uris?.normal ?? scryfallCard.card_faces?.[0]?.image_uris?.normal ?? null;
			const manaCost = scryfallCard.mana_cost ?? scryfallCard.card_faces?.[0]?.mana_cost ?? null;

			return {
				name: parsed.name,
				qty: parsed.qty,
				imageUrl,
				manaCost,
				prices: {
					usd: scryfallCard.prices.usd,
					usdFoil: scryfallCard.prices.usd_foil,
					eur: scryfallCard.prices.eur,
					eurFoil: scryfallCard.prices.eur_foil,
					tix: scryfallCard.prices.tix
				},
				oracleId: scryfallCard.oracle_id ?? undefined
			};
		}

		return {
			name: parsed.name,
			qty: parsed.qty,
			imageUrl: null,
			manaCost: null
		};
	});
}

export function createCardIdentifiers(
	parsedCards: Array<{ name: string; qty: number; set?: string; collector_number?: string }>
): CardIdentifier[] {
	const seen = new Set<string>();
	const identifiers: CardIdentifier[] = [];

	for (const card of parsedCards) {
		const key = card.set
			? `${card.name.toLowerCase()}-${card.set.toLowerCase()}-${card.collector_number?.toLowerCase() || ''}`
			: card.name.toLowerCase();

		if (seen.has(key)) continue;
		seen.add(key);

		if (card.set && card.collector_number) {
			identifiers.push({
				set: card.set.toLowerCase(),
				collector_number: card.collector_number,
				name: card.name
			});
		} else if (card.set) {
			identifiers.push({
				name: card.name,
				set: card.set.toLowerCase()
			});
		} else {
			identifiers.push({
				name: card.name
			});
		}
	}

	return identifiers;
}
