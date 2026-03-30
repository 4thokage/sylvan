import type { RequestHandler } from './$types';
import { fetchCardsByIdentifiers, type CardIdentifier } from '$lib/scryfall/api';

interface CardInput {
	name: string;
	set?: string;
	collector_number?: string;
	selectedPrintIndex?: number;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();
		const cards = data.cards as CardInput[];

		if (!cards || cards.length === 0) {
			return new Response(
				JSON.stringify({ success: false, error: { message: 'No cards provided' } }),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		const cardsWithPrintSelection = cards.filter((c) => c.selectedPrintIndex !== undefined);
		const cardsWithoutPrintSelection = cards.filter((c) => c.selectedPrintIndex === undefined);

		console.log('[PriceAPI] Cards with print selection:', cardsWithPrintSelection.length);
		console.log('[PriceAPI] Cards without print selection:', cardsWithoutPrintSelection.length);

		const identifiers: CardIdentifier[] = cards.map((card) => ({
			name: card.name,
			...(card.set && { set: card.set.toLowerCase() }),
			...(card.collector_number && { collector_number: card.collector_number })
		}));

		const { cards: scryfallCards } = await fetchCardsByIdentifiers(identifiers);

		console.log('[PriceAPI] Scryfall returned cards:', scryfallCards.length);

		const pricesMap = new Map<
			string,
			{
				usd: string | null;
				usdFoil: string | null;
				eur: string | null;
				eurFoil: string | null;
				tix: string | null;
				oracleId: string | null;
				set: string | null;
				setName: string | null;
			}
		>();

		const cardDetailsMap = new Map<
			string,
			{
				imageUrl: string | null;
				manaCost: string | null;
			}
		>();

		for (const card of scryfallCards) {
			const key = card.name.toLowerCase();
			const imageUrl = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null;
			const manaCost = card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? null;

			if (!pricesMap.has(key)) {
				pricesMap.set(key, {
					usd: card.prices.usd,
					usdFoil: card.prices.usd_foil,
					eur: card.prices.eur,
					eurFoil: card.prices.eur_foil,
					tix: card.prices.tix,
					oracleId: card.oracle_id,
					set: card.set,
					setName: card.set_name
				});

				cardDetailsMap.set(key, { imageUrl, manaCost });
			}
		}

		const prices = cards.map((card) => {
			const key = card.name.toLowerCase();
			const isSelected = card.selectedPrintIndex !== undefined;

			return {
				name: card.name,
				selectedPrintIndex: card.selectedPrintIndex,
				isSelected,
				prices: pricesMap.get(key) || null,
				imageUrl: cardDetailsMap.get(key)?.imageUrl || null,
				manaCost: cardDetailsMap.get(key)?.manaCost || null
			};
		});

		console.log('[PriceAPI] Returning prices:', prices.length);

		return new Response(JSON.stringify({ success: true, data: { prices } }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch prices';
		console.error('[PriceAPI] Error:', err);
		console.error('[PriceAPI] Stack:', err instanceof Error ? err.stack : 'no stack');
		return new Response(JSON.stringify({ success: false, error: { message } }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
