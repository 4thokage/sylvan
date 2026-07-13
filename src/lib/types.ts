export type CardCondition = 'NM' | 'LP' | 'MP' | 'HP' | 'DMG';
export type CardFinish = 'non-foil' | 'foil' | 'foil-etched' | 'holo' | 'reverse-holo';

export interface CardPrices {
	usd: string | null;
	eur: string | null;
}

export interface Card {
	id: string;
	name: string;
	normalizedName: string;
	imageUrl: string | null;
	manaCost: string | null;
	typeLine: string | null;
	gameSlug: string;
}

export interface CardPrinting {
	id: string;
	cardId: string;
	setCode: string;
	setName: string;
	collectorNumber: string | null;
	rarity: string | null;
	language: string;
	finish: CardFinish;
	factorySigned: boolean;
	imageUrl: string | null;
	manaCost: string | null;
	prices: CardPrices;
	releasedAt: string | null;
}

export interface HaveStack {
	id: string;
	ownerId: string;
	printing: CardPrinting;
	quantity: number;
	condition: CardCondition;
	aftermarketSigned: boolean;
	isAltered: boolean;
	isTradeable: boolean;
	location: string | null;
	notes: string | null;
}

export interface WishlistItemFilter {
	id: string;
	card: Card;
	printing?: CardPrinting;
	quantity: number;
	condition: CardCondition | null;
	finish: CardFinish | null;
	aftermarketSigned: boolean | null;
	isAltered: boolean | null;
	language: string | null;
}

// Legacy UI row type used while components are migrated to the split model.
// Prefer Card / CardPrinting / HaveStack / WishlistItemFilter in new code.
export interface WishlistCard {
	name: string;
	qty: number;
	imageUrl: string | null;
	manaCost: string | null;
	prices?: CardPrices;
	printings?: CardPrinting[];
	selectedPrintIndex?: number;
	cardPrintingId?: string | null;
	set?: string;
	collectorNumber?: string;
	condition: CardCondition;
	finish: CardFinish | null;
	aftermarketSigned: boolean;
	isAltered: boolean;
	language: string | null;
	isTradeable?: boolean;
	localId?: string;
}

export interface LookupResult {
	name: string;
	qty: number;
	imageUrl: string | null;
	manaCost: string | null;
	prices?: CardPrices;
	cardPrintingId?: string;
	set?: string;
	collectorNumber?: string;
	printings?: CardPrinting[];
	finish?: CardFinish;
}
