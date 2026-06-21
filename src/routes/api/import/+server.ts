import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { saveRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { requireAuth } from '$lib/server/middleware/auth';
import { replaceCollection, saveCollection } from '$lib/server/services/collection.service';
import { findOrCreateCard } from '$lib/server/services/card.service';
import { supabase } from '$lib/server/supabase';
import { parseCardList, parseCsv, parseDeckbox } from '$lib/parser';

async function resolveCardPrintingIds(
	cards: Array<{ name: string; qty: number }>,
	gameSlug: string
): Promise<Array<{ card_printing_id: string; quantity: number }>> {
	const resolved: Array<{ card_printing_id: string; quantity: number }> = [];

	for (const card of cards) {
		const cardResult = await findOrCreateCard(gameSlug, card.name);

		if (!cardResult) continue;

		const printing = cardResult.printings[0];
		if (!printing) continue;

		resolved.push({ card_printing_id: printing.id, quantity: card.qty });
	}

	return resolved;
}

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	const clerkUserId = await requireAuth(event);
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

		const resolved = await resolveCardPrintingIds(parsedCards, gameSlug);
		if (resolved.length === 0) {
			return json(
				{ success: false, error: { message: 'No valid card names could be resolved' } },
				{ status: 400 }
			);
		}

		if (merge) {
			const result = await saveCollection(clerkUserId, resolved, gameSlug);
			return json({ success: true, data: { count: resolved.length, errors: result.errors } });
		} else {
			await replaceCollection(clerkUserId, resolved, gameSlug);
			return json({ success: true, data: { count: resolved.length } });
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Import failed';
		return json({ success: false, error: { message } }, { status: 500 });
	}
};
