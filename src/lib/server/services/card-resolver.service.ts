import { findOrCreateCard } from './card.service';
import type { CardLookupResult } from './card.service';

export interface ResolvedCard {
	cardId: string;
	cardName: string;
	printingId: string;
	setCode: string | null;
	collectorNumber: string | null;
}

export interface ResolveCardsInput {
	name: string;
	qty: number;
	set?: string;
	collectorNumber?: string;
	finish?: string;
	cardPrintingId?: string | null;
}

export interface ResolvedCardOutput extends ResolvedCard {
	qty: number;
}

export function resolvePrinting(
	cardResult: CardLookupResult,
	input: ResolveCardsInput
): string | null {
	// Only honor a client-supplied printing id if it is a real UUID that already
	// belongs to one of the resolved card's printings. The client may send a
	// provider composite key (e.g. `<scryfallId>-foil`) or a stale printing id,
	// neither of which should be trusted as a foreign key. Resolving by physical
	// attributes instead also prevents a caller from attaching an arbitrary
	// printing to their collection/wishlist.
	if (input.cardPrintingId) {
		const match = cardResult.printings.find((p) => p.id === input.cardPrintingId);
		if (match) return match.id;
	}

	let candidates = cardResult.printings;

	if (input.set && input.collectorNumber) {
		const exact = candidates.filter(
			(p) => p.setCode === input.set && p.collectorNumber === input.collectorNumber
		);
		if (exact.length > 0) candidates = exact;
	} else if (input.set) {
		const setMatches = candidates.filter((p) => p.setCode === input.set);
		if (setMatches.length > 0) candidates = setMatches;
	}

	if (input.finish) {
		const finishMatch = candidates.find((p) => p.finish === input.finish);
		if (finishMatch) return finishMatch.id;
	}

	if (candidates.length > 0) return candidates[0].id;
	if (cardResult.printings.length > 0) return cardResult.printings[0].id;
	return null;
}

export async function resolveCards(
	gameSlug: string,
	cards: ResolveCardsInput[]
): Promise<{ resolved: ResolvedCardOutput[]; errors: string[] }> {
	const resolved: ResolvedCardOutput[] = [];
	const errors: string[] = [];

	for (const card of cards) {
		const cardResult = await findOrCreateCard(gameSlug, card.name, card.set, card.collectorNumber);
		if (!cardResult) {
			errors.push(`Card not found: ${card.name}`);
			continue;
		}

		const resolvedPrintingId = resolvePrinting(cardResult, card);
		if (!resolvedPrintingId) {
			errors.push(`No printing found for: ${card.name}`);
			continue;
		}

		resolved.push({
			cardId: cardResult.id,
			cardName: cardResult.name,
			printingId: resolvedPrintingId,
			setCode: cardResult.printings.find((p) => p.id === resolvedPrintingId)?.setCode || null,
			collectorNumber:
				cardResult.printings.find((p) => p.id === resolvedPrintingId)?.collectorNumber || null,
			qty: card.qty
		});
	}

	return { resolved, errors };
}
