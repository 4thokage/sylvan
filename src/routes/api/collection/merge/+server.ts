import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { saveRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { requireAuth } from '$lib/server/middleware/auth';
import { resolveCards } from '$lib/server/services/card-resolver.service';
import { saveCollection } from '$lib/server/services/collection.service';

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	const clerkUserId = await requireAuth(event);
	if (typeof clerkUserId !== 'string') return clerkUserId;
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

	const { resolved, errors } = await resolveCards(gameSlug, cards);
	if (resolved.length === 0) {
		return json({ success: false, error: { message: errors.join(', ') } }, { status: 400 });
	}

	const result = await saveCollection(
		clerkUserId,
		resolved.map((r) => ({ card_printing_id: r.printingId, quantity: r.qty })),
		gameSlug
	);
	return json({
		success: true,
		data: { count: resolved.length, errors: [...result.errors, ...errors] }
	});
};
