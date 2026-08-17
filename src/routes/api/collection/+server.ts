import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { collectionSaveRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { requireUser } from '$lib/server/middleware/auth';
import {
	getCollection,
	replaceCollection,
	clearCollection
} from '$lib/server/services/collection.service';
import { resolveCards } from '$lib/server/services/card-resolver.service';
import { getSupabase } from '$lib/server/supabase';
import type { CardCondition } from '$lib/server/repositories/types';

interface CollectionCardInput {
	name: string;
	qty: number;
	cardPrintingId?: string | null;
	set?: string;
	collector_number?: string;
	condition?: CardCondition;
	finish?: string | null;
	aftermarketSigned?: boolean;
	isAltered?: boolean;
	isTradeable?: boolean;
	location?: string;
	notes?: string;
}

export const GET: RequestHandler = async (event) => {
	const { url } = event;
	const authUser = await requireUser(event);
	if (!('clerkUserId' in authUser)) return authUser;
	const clerkUserId = authUser.clerkUserId;
	const gameSlug = url.searchParams.get('game') || 'mtg';
	const cards = await getCollection(clerkUserId, gameSlug);
	return json({ success: true, data: { cards } });
};

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	const authUser = await requireUser(event);
	if (!('clerkUserId' in authUser)) return authUser;
	const clerkUserId = authUser.clerkUserId;
	const rateCheck = collectionSaveRateLimiter(event, clerkUserId);
	if (!rateCheck.passed) return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);

	const body = await request.json();
	const gameSlug = body.gameSlug || 'mtg';

	const { data: game } = await getSupabase()
		.from('games')
		.select('id')
		.eq('slug', gameSlug)
		.single();

	if (!game) {
		return json({ success: false, error: { message: 'Game not found' } }, { status: 400 });
	}

	const rawCards = (body.cards as CollectionCardInput[] | undefined) || [];
	const cardResults = await resolveCards(
		gameSlug,
		rawCards.map((c) => ({
			name: c.name,
			qty: c.qty,
			set: c.set,
			collectorNumber: c.collector_number,
			finish: c.finish || undefined,
			cardPrintingId: c.cardPrintingId || undefined
		}))
	);

	if (cardResults.resolved.length === 0) {
		return json(
			{ success: false, error: { message: cardResults.errors.join(', ') } },
			{ status: 400 }
		);
	}

	const resolved = cardResults.resolved.map((r) => {
		const input = rawCards[r.index];
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
	});

	const result = await replaceCollection(clerkUserId, resolved, gameSlug);
	return json({ success: true, data: { errors: [...result.errors, ...cardResults.errors] } });
};

export const DELETE: RequestHandler = async (event) => {
	const { url } = event;
	const authUser = await requireUser(event);
	if (!('clerkUserId' in authUser)) return authUser;
	const clerkUserId = authUser.clerkUserId;
	const gameSlug = url.searchParams.get('game') || undefined;
	await clearCollection(clerkUserId, gameSlug);
	return json({ success: true });
};
