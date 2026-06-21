import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { searchRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { getCard, resolveCards } from '$lib/api/card-service';
import { parseCardList } from '$lib/parser';

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	const rateCheck = searchRateLimiter(event);
	if (!rateCheck.passed) {
		return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);
	}

	try {
		const body = await request.json();
		const gameSlug = body.game || 'mtg';

		if (!['mtg', 'pokemon', 'riftbound'].includes(gameSlug)) {
			return json({ success: false, error: { message: 'Unsupported game' } }, { status: 400 });
		}

		let cards: Array<{ name: string; qty: number; set?: string; collector_number?: string }>;

		if (body.text) {
			cards = parseCardList(body.text);
		} else if (body.cards) {
			cards = body.cards;
		} else {
			return json({ success: false, error: { message: 'Provide text or cards' } }, { status: 400 });
		}

		if (cards.length === 0) {
			return json({ success: true, data: { cards: [] } });
		}

		if (cards.length > 500) {
			return json(
				{ success: false, error: { message: 'Too many cards (max 500)' } },
				{ status: 400 }
			);
		}

		const resolved = await resolveCards(gameSlug, cards);
		return json({ success: true, data: { cards: resolved } });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Lookup failed';
		return json({ success: false, error: { message } }, { status: 500 });
	}
};
