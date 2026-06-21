import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { saveRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { requireAuth } from '$lib/server/middleware/auth';
import { saveCollection } from '$lib/server/services/collection.service';
import { supabase } from '$lib/server/supabase';

async function resolveCardPrintingIds(
	cards: Array<{ name: string; qty: number }>,
	gameId: string
): Promise<Array<{ card_printing_id: string; quantity: number }>> {
	const resolved: Array<{ card_printing_id: string; quantity: number }> = [];

	for (const card of cards) {
		const normalizedName = card.name.toLowerCase().trim();
		const { data: found } = await supabase
			.from('cards')
			.select('id')
			.eq('normalized_name', normalizedName)
			.eq('game_id', gameId)
			.maybeSingle();

		if (!found) continue;

		const { data: printing } = await supabase
			.from('card_printings')
			.select('id')
			.eq('card_id', found.id)
			.limit(1)
			.maybeSingle();

		if (!printing) continue;

		resolved.push({ card_printing_id: printing.id, quantity: card.qty });
	}

	return resolved;
}

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	const clerkUserId = await requireAuth(event);
	const rateCheck = saveRateLimiter({
		request,
		getClientAddress: () => request.headers.get('x-forwarded-for') || 'unknown'
	} as any);
	if (!rateCheck.passed) return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);

	const body = await request.json();
	const cards: Array<{ name: string; qty: number }> = body.cards || [];
	const gameSlug = body.gameSlug || 'mtg';

	if (cards.length === 0) {
		return json({ success: false, error: { message: 'No cards provided' } }, { status: 400 });
	}
	if (cards.length > 5000) {
		return json(
			{ success: false, error: { message: 'Too many cards (max 5000)' } },
			{ status: 400 }
		);
	}

	const { data: game } = await supabase.from('games').select('id').eq('slug', gameSlug).single();

	if (!game) {
		return json({ success: false, error: { message: 'Game not found' } }, { status: 400 });
	}

	const resolved = await resolveCardPrintingIds(cards, game.id);
	if (resolved.length === 0) {
		return json({ success: false, error: { message: 'No valid cards found' } }, { status: 400 });
	}

	const result = await saveCollection(clerkUserId, resolved, gameSlug);
	return json({ success: true, data: { count: resolved.length, errors: result.errors } });
};
