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
	oracleId?: string | null;
	cardPrintingId?: string | null;
}

export interface ResolvedCardOutput extends ResolvedCard {
	qty: number;
}

export function resolvePrinting(
	cardResult: CardLookupResult,
	input: ResolveCardsInput
): string | null {
	if (input.cardPrintingId) return input.cardPrintingId;
	if (input.set && input.collectorNumber) {
		const match = cardResult.printings.find(
			(p) => p.setCode === input.set && p.collectorNumber === input.collectorNumber
		);
		if (match) return match.id;
	}
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
		const cardResult = await findOrCreateCard(
			gameSlug,
			card.name,
			card.set,
			card.collectorNumber,
			card.oracleId
		);
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
