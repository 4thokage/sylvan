import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { saveRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { requireAuth } from '$lib/server/middleware/auth';
import { resolveCards } from '$lib/server/services/card-resolver.service';
import { replaceCollection, saveCollection } from '$lib/server/services/collection.service';
import { supabase } from '$lib/server/supabase';
import { parseCardList, parseCsv, parseDeckbox } from '$lib/parser';

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	const clerkUserId = await requireAuth(event);
	if (typeof clerkUserId !== 'string') return clerkUserId;
	const rateCheck = saveRateLimiter(event);
	if (!rateCheck.passed) {
		return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);
	}

	try {
		const body = await request.json();
		const format = body.format || 'text';
		const merge = body.merge !== false;
		const text = body.text || '';
		const gameSlug: string = body.game || 'mtg';

		if (!['mtg', 'pokemon', 'riftbound'].includes(gameSlug)) {
			return json({ success: false, error: { message: 'Unsupported game' } }, { status: 400 });
		}

		const { data: game } = await supabase.from('games').select('id').eq('slug', gameSlug).single();

		if (!game) {
			return json({ success: false, error: { message: 'Game not found' } }, { status: 400 });
		}

		let parsedCards: Array<{ name: string; qty: number }>;

		switch (format) {
			case 'csv':
				parsedCards = parseCsv(text).map((c) => ({ name: c.name, qty: c.qty }));
				break;
			case 'deckbox':
				parsedCards = parseDeckbox(text).map((c) => ({ name: c.name, qty: c.qty }));
				break;
			case 'text':
			default:
				parsedCards = parseCardList(text).map((c) => ({ name: c.name, qty: c.qty }));
				break;
		}

		if (parsedCards.length === 0) {
			return json(
				{ success: false, error: { message: 'No cards found in input' } },
				{ status: 400 }
			);
		}
		if (parsedCards.length > 5000) {
			return json(
				{ success: false, error: { message: 'Too many cards (max 5000)' } },
				{ status: 400 }
			);
		}

		const cardResults = await resolveCards(gameSlug, parsedCards);
		if (cardResults.resolved.length === 0) {
			return json(
				{
					success: false,
					error: {
						message: cardResults.errors.join(', ') || 'No valid card names could be resolved'
					}
				},
				{ status: 400 }
			);
		}

		const resolved = cardResults.resolved.map((r) => ({
			card_printing_id: r.printingId,
			quantity: r.qty
		}));

		if (merge) {
			const result = await saveCollection(clerkUserId, resolved, gameSlug);
			return json({
				success: true,
				data: { count: resolved.length, errors: [...result.errors, ...cardResults.errors] }
			});
		} else {
			await replaceCollection(clerkUserId, resolved, gameSlug);
			return json({ success: true, data: { count: resolved.length } });
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Import failed';
		return json({ success: false, error: { message } }, { status: 500 });
	}
};
