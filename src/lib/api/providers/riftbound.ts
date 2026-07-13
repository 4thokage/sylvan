import type { TcgProvider, TcgCard, TcgPrinting, TcgExternalRef } from './types';

const API_BASE = 'https://api.riftcodex.com';

const HEADERS = {
	Accept: 'application/json',
	'User-Agent': 'SylvanApp/1.0'
};

function normalize(rawName: string): string {
	return rawName
		.toLowerCase()
		.trim()
		.replace(/['"]/g, '')
		.replace(/[-\s]+/g, ' ');
}

interface RiftcodexCard {
	id: string;
	name: string;
	riftbound_id: string;
	tcgplayer_id: string;
	collector_number: number;
	attributes: {
		energy?: number;
		might?: number;
		power?: number;
	};
	classification: {
		type: string;
		supertype?: string;
		rarity: string;
		domain: string[];
	};
	text: {
		rich: string;
		plain: string;
		flavour?: string;
	};
	set: {
		set_id: string;
		label: string;
	};
	media: {
		image_url: string;
		artist: string;
		accessibility_text: string;
	};
	tags: string[];
	orientation: string;
	metadata: {
		clean_name: string;
		updated_on: string;
		alternate_art: boolean;
		overnumbered: boolean;
		signature: boolean;
	};
}

function buildRefs(raw: RiftcodexCard): TcgExternalRef[] {
	const refs: TcgExternalRef[] = [
		{
			providerSlug: 'riftbound',
			identifierType: 'riftbound_id',
			externalId: raw.riftbound_id
		},
		{
			providerSlug: 'riftbound',
			identifierType: 'riftbound_card_id',
			externalId: raw.id
		}
	];
	return refs;
}

function detectFinish(raw: RiftcodexCard): string {
	const tags = (raw.tags || []).map((t) => t.toLowerCase());
	if (tags.includes('foil') || tags.includes('holo')) return 'holo';
	if (raw.metadata?.signature) return 'non-foil';
	return 'non-foil';
}

function mapToTcgCard(raw: RiftcodexCard): TcgCard {
	return {
		id: raw.id,
		name: raw.name,
		normalizedName: normalize(raw.name || ''),
		imageUrl: raw.media?.image_url || null,
		manaCost: raw.attributes?.energy != null ? String(raw.attributes.energy) : null,
		typeLine: raw.classification?.type || null,
		setCode: raw.set?.set_id || '',
		setName: raw.set?.label || '',
		collectorNumber: raw.collector_number != null ? String(raw.collector_number) : '',
		rarity: raw.classification?.rarity || '',
		language: 'en',
		finish: detectFinish(raw),
		factorySigned: raw.metadata?.signature || false,
		prices: { usd: null, eur: null },
		externalRefs: buildRefs(raw),
		gameSlug: 'riftbound'
	};
}

export const riftboundProvider: TcgProvider = {
	gameSlug: 'riftbound',
	gameName: 'Riftbound',

	normalizeName: normalize,

	async searchCards(
		query: string,
		limit = 25
	): Promise<{ cards: TcgCard[]; totalCount: number; hasMore: boolean }> {
		try {
			const response = await fetch(
				`${API_BASE}/cards/search?query=${encodeURIComponent(query)}&size=${limit}`,
				{ headers: HEADERS }
			);
			if (!response.ok) {
				return { cards: [], totalCount: 0, hasMore: false };
			}
			const data = await response.json();
			const cards = (data.data || []).map(mapToTcgCard);
			return { cards, totalCount: data.total || 0, hasMore: false };
		} catch {
			return { cards: [], totalCount: 0, hasMore: false };
		}
	},

	async fuzzySearchCard(name: string): Promise<TcgCard | null> {
		return this.getCard(name);
	},

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async getCard(name: string, _set?: string, _collectorNumber?: string): Promise<TcgCard | null> {
		try {
			let response = await fetch(`${API_BASE}/cards/name?exact=${encodeURIComponent(name)}`, {
				headers: HEADERS
			});
			if (!response.ok) {
				response = await fetch(`${API_BASE}/cards/name?fuzzy=${encodeURIComponent(name)}`, {
					headers: HEADERS
				});
			}
			if (!response.ok) return null;
			const data = await response.json();
			const card = Array.isArray(data) ? data[0] : data;
			if (!card) return null;
			return mapToTcgCard(card);
		} catch {
			return null;
		}
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

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async getAllPrintings(_cardName: string): Promise<TcgPrinting[]> {
		return [];
	}
};
