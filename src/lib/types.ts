export interface CardPrices {
	usd: string | null;
	usdFoil: string | null;
	eur: string | null;
	eurFoil: string | null;
	tix: string | null;
}

export interface CardPrint {
	id: string;
	name: string;
	set: string;
	setName: string;
	collectorNumber: string;
	rarity: string;
	price: string | null;
	priceFoil: string | null;
	imageUrl: string | null;
	manaCost: string | null;
}

export interface WishlistCard {
	name: string;
	qty: number;
	imageUrl: string | null;
	manaCost: string | null;
	prices?: CardPrices;
	oracleId?: string;
	printings?: CardPrint[];
	selectedPrintIndex?: number;
	cardPrintingId?: string | null;
	set?: string;
	collectorNumber?: string;
	condition: string;
	isFoil: boolean;
	isSigned: boolean;
	isAltered: boolean;
	language: string;
	isTradeable?: boolean;
}

export interface LookupResult {
	name: string;
	qty: number;
	imageUrl: string | null;
	manaCost: string | null;
	prices?: Record<string, string | null>;
	oracleId?: string;
	cardPrintingId?: string;
	set?: string;
	collectorNumber?: string;
	printings?: CardPrint[];
}
