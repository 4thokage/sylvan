import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { PriceRequestSchema } from '$lib/schemas/api';
import { searchRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { resolveCards } from '$lib/api/card-service';

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	const rateCheck = searchRateLimiter(event);
	if (!rateCheck.passed) {
		return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);
	}

	try {
		const body = await request.json();
		const parsed = PriceRequestSchema.safeParse(body);
		if (!parsed.success) {
			return json(
				{ success: false, error: { message: 'Invalid input', details: parsed.error.issues } },
				{ status: 400 }
			);
		}

		const { cards, gameSlug } = parsed.data;

		const resolved = await resolveCards(
			gameSlug,
			cards.map((c) => ({
				name: c.name,
				qty: 1,
				set: c.set,
				collector_number: c.collector_number,
				finish: c.finish,
				cardPrintingId: c.cardPrintingId
			}))
		);

		const prices = cards.map((card) => {
			const found = resolved.find((r) => r.name.toLowerCase() === card.name.toLowerCase());
			return {
				name: card.name,
				cardPrintingId: found?.cardPrintingId || null,
				finish: found?.finish || null,
				prices: found?.prices
					? {
							usd: found.prices.usd ?? null,
							eur: found.prices.eur ?? null
						}
					: null,
				imageUrl: found?.imageUrl || null,
				manaCost: found?.manaCost || null
			};
		});

		return json({ success: true, data: { prices } });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch prices';
		console.error('[PriceAPI] Error:', err);
		return json({ success: false, error: { message } }, { status: 500 });
	}
};
