import type { RequestHandler } from './$types';
import type { RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { saveRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { requireAuth } from '$lib/server/middleware/auth';
import { resolveCards } from '$lib/server/services/card-resolver.service';
import { saveCollection } from '$lib/server/services/collection.service';
import type { CardCondition } from '$lib/server/repositories/types';

interface MergeCardInput {
	name: string;
	qty: number;
	set?: string;
	collector_number?: string;
	finish?: string | null;
	condition?: CardCondition;
	aftermarketSigned?: boolean;
	isAltered?: boolean;
	isTradeable?: boolean;
	location?: string;
	notes?: string;
}

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	const clerkUserId = await requireAuth(event);
	if (typeof clerkUserId !== 'string') return clerkUserId;
	const rateCheck = saveRateLimiter({
		request,
		getClientAddress: () => request.headers.get('x-forwarded-for') || 'unknown'
	} as unknown as RequestEvent);
	if (!rateCheck.passed) return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);

	const body = await request.json();
	const cards: MergeCardInput[] = body.cards || [];
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

	const { resolved, errors } = await resolveCards(
		gameSlug,
		cards.map((c) => ({
			name: c.name,
			qty: c.qty,
			set: c.set,
			collectorNumber: c.collector_number,
			finish: c.finish || undefined
		}))
	);
	if (resolved.length === 0) {
		return json({ success: false, error: { message: errors.join(', ') } }, { status: 400 });
	}

	const result = await saveCollection(
		clerkUserId,
		resolved.map((r) => {
			const input = cards.find((c) => c.name === r.cardName);
			return {
				card_printing_id: r.printingId,
				quantity: r.qty,
				condition: input?.condition || 'NM',
				aftermarket_signed: input?.aftermarketSigned || false,
				is_altered: input?.isAltered || false,
				is_tradeable: input?.isTradeable !== undefined ? input.isTradeable : true,
				location: input?.location || null,
				notes: input?.notes || null
			};
		}),
		gameSlug
	);
	return json({
		success: true,
		data: { count: resolved.length, errors: [...result.errors, ...errors] }
	});
};
