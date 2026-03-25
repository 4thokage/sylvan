export type { ScryfallCard, WishlistCard, CardIdentifier, CardPrices, CardPrint } from './client';
export { fetchCardsByIdentifiers, convertToWishlistCards, createCardIdentifiers } from './client';

import type { ParsedCard } from '$lib/parser';
import {
	fetchCardsByIdentifiers,
	convertToWishlistCards,
	createCardIdentifiers,
	type WishlistCard
} from './client';

export async function getCards(parsedCards: ParsedCard[]): Promise<{
	cards: WishlistCard[];
	loading: boolean;
	error: string | null;
}> {
	if (parsedCards.length === 0) {
		return { cards: [], loading: false, error: null };
	}

	try {
		const identifiers = createCardIdentifiers(parsedCards);
		const { cards: scryfallCards } = await fetchCardsByIdentifiers(identifiers);
		const wishlistCards = convertToWishlistCards(parsedCards, scryfallCards);

		return { cards: wishlistCards, loading: false, error: null };
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : 'Failed to fetch card data';
		return {
			cards: parsedCards.map((card) => ({
				name: card.name,
				qty: card.qty,
				imageUrl: null,
				manaCost: null
			})),
			loading: false,
			error: errorMessage
		};
	}
}

export function lookupCard(): null {
	return null;
}
