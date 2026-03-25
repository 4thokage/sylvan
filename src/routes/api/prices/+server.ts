import type { RequestHandler } from './$types';
import { fetchCardsByIdentifiers, type CardIdentifier } from '$lib/scryfall/api';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();
		const cards = data.cards as Array<{
			name: string;
			set?: string;
			collector_number?: string;
		}>;

		if (!cards || cards.length === 0) {
			return new Response(
				JSON.stringify({ success: false, error: { message: 'No cards provided' } }),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		console.log('[PriceAPI] Fetching prices for cards:', cards.length);

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

		for (const card of scryfallCards) {
			const key = card.name.toLowerCase();
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
			}
		}

		const prices = cards.map((card) => ({
			name: card.name,
			prices: pricesMap.get(card.name.toLowerCase()) || null
		}));

		console.log('[PriceAPI] Returning prices:', prices.length);

		return new Response(JSON.stringify({ success: true, data: { prices } }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch prices';
		console.error('[PriceAPI] Error:', err);
		return new Response(JSON.stringify({ success: false, error: { message } }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
