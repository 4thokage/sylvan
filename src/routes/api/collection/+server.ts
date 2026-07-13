import type { RequestHandler } from './$types';
import type { RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { apiRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { requireUser } from '$lib/server/middleware/auth';
import {
	getCollection,
	replaceCollection,
	clearCollection
} from '$lib/server/services/collection.service';
import { findOrCreateCard } from '$lib/server/services/card.service';
import { resolvePrinting } from '$lib/server/services/card-resolver.service';
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

interface ResolvedCollectionCard {
	card_printing_id: string;
	quantity: number;
	condition: CardCondition;
	aftermarket_signed: boolean;
	is_altered: boolean;
	is_tradeable: boolean;
	location: string | null;
	notes: string | null;
}

async function resolveCardPrintings(
	cards: CollectionCardInput[],
	gameSlug: string
): Promise<{ resolved: ResolvedCollectionCard[]; errors: string[] }> {
	const resolved: ResolvedCollectionCard[] = [];
	const errors: string[] = [];

	for (const card of cards) {
		const cardResult = await findOrCreateCard(gameSlug, card.name, card.set, card.collector_number);

		if (!cardResult) {
			errors.push(`Card not found: ${card.name}`);
			continue;
		}

		const printingId = resolvePrinting(cardResult, {
			name: card.name,
			qty: card.qty,
			set: card.set,
			collectorNumber: card.collector_number,
			finish: card.finish || undefined,
			cardPrintingId: card.cardPrintingId || undefined
		});

		if (!printingId) {
			errors.push(`No printing found for: ${card.name}`);
			continue;
		}

		resolved.push({
			card_printing_id: printingId,
			quantity: card.qty,
			condition: card.condition || 'NM',
			aftermarket_signed: card.aftermarketSigned || false,
			is_altered: card.isAltered || false,
			is_tradeable: card.isTradeable !== undefined ? card.isTradeable : true,
			location: card.location || null,
			notes: card.notes || null
		});
	}

	return { resolved, errors };
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
	const rateCheck = apiRateLimiter({
		request,
		getClientAddress: () => request.headers.get('x-forwarded-for') || 'unknown'
	} as unknown as RequestEvent);
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

	const rawCards = body.cards || [];
	const { resolved, errors } = await resolveCardPrintings(rawCards, gameSlug);

	if (resolved.length === 0) {
		return json({ success: false, error: { message: errors.join(', ') } }, { status: 400 });
	}

	const result = await replaceCollection(clerkUserId, resolved, gameSlug);
	return json({ success: true, data: { errors: [...result.errors, ...errors] } });
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
