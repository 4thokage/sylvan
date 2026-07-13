import type { TcgCard, TcgPrinting, TcgProvider } from './providers/types';
import { scryfallProvider } from './providers/scryfall';
import { pokemonProvider } from './providers/pokemon';
import { riftboundProvider } from './providers/riftbound';

const providers: Record<string, TcgProvider> = {
	mtg: scryfallProvider,
	pokemon: pokemonProvider,
	riftbound: riftboundProvider
};

export const SUPPORTED_GAMES: Array<{ slug: string; name: string }> = [
	{ slug: 'mtg', name: 'Magic: The Gathering' },
	{ slug: 'pokemon', name: 'Pokémon TCG' },
	{ slug: 'riftbound', name: 'Riftbound' }
];

export function getProvider(gameSlug: string): TcgProvider {
	const provider = providers[gameSlug];
	if (!provider) throw new Error(`Unsupported game: ${gameSlug}`);
	return provider;
}

export async function searchCards(
	gameSlug: string,
	query: string,
	limit = 25
): Promise<{ cards: TcgCard[]; totalCount: number; hasMore: boolean }> {
	return getProvider(gameSlug).searchCards(query, limit);
}

export async function getCard(
	gameSlug: string,
	name: string,
	set?: string,
	collectorNumber?: string
): Promise<TcgCard | null> {
	return getProvider(gameSlug).getCard(name, set, collectorNumber);
}

export async function fuzzySearchCard(gameSlug: string, name: string): Promise<TcgCard | null> {
	return getProvider(gameSlug).fuzzySearchCard(name);
}

export async function getCardsByIdentifiers(
	gameSlug: string,
	identifiers: Array<{ name: string; set?: string; collectorNumber?: string }>
): Promise<TcgCard[]> {
	return getProvider(gameSlug).getCardsByIdentifiers(identifiers);
}

export async function getAllPrintings(gameSlug: string, cardName: string): Promise<TcgPrinting[]> {
	return getProvider(gameSlug).getAllPrintings(cardName);
}

export interface ResolvedCard {
	name: string;
	qty: number;
	imageUrl: string | null;
	manaCost: string | null;
	prices?: { usd: string | null; eur: string | null };
	set?: string;
	collectorNumber?: string;
	cardPrintingId?: string;
	finish?: string;
}

export async function resolveCards(
	gameSlug: string,
	parsedCards: Array<{ name: string; qty: number; set?: string; collector_number?: string }>
): Promise<ResolvedCard[]> {
	const identifiers = parsedCards.map((c) => ({
		name: c.name,
		set: c.set,
		collectorNumber: c.collector_number
	}));

	const cards = await getCardsByIdentifiers(gameSlug, identifiers);

	return parsedCards.map((parsed) => {
		const found = cards.find(
			(c) => c.normalizedName === getProvider(gameSlug).normalizeName(parsed.name)
		);
		if (found) {
			return {
				name: parsed.name,
				qty: parsed.qty,
				imageUrl: found.imageUrl,
				manaCost: found.manaCost,
				prices: found.prices,
				set: found.setCode || undefined,
				collectorNumber: found.collectorNumber || undefined,
				cardPrintingId: found.id || undefined,
				finish: found.finish || undefined
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
