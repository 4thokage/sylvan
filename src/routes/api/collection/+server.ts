import type { RequestHandler } from './$types';
import type { RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { apiRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { requireAuth } from '$lib/server/middleware/auth';
import {
	getCollection,
	replaceCollection,
	clearCollection
} from '$lib/server/services/collection.service';
import { findOrCreateCard } from '$lib/server/services/card.service';
import { supabase } from '$lib/server/supabase';

async function resolveCardPrintings(
	cards: Array<{
		name: string;
		qty: number;
		cardPrintingId?: string | null;
		set?: string;
		collector_number?: string;
		condition?: string;
		isFoil?: boolean;
		isSigned?: boolean;
		isAltered?: boolean;
		language?: string;
		isTradeable?: boolean;
	}>,
	gameSlug: string
): Promise<{
	resolved: Array<{
		card_printing_id: string;
		quantity: number;
		condition?: string;
		is_foil?: boolean;
		is_signed?: boolean;
		is_altered?: boolean;
		language?: string;
		is_tradeable?: boolean;
	}>;
	errors: string[];
}> {
	const resolved: Array<{
		card_printing_id: string;
		quantity: number;
		condition?: string;
		is_foil?: boolean;
		is_signed?: boolean;
		is_altered?: boolean;
		language?: string;
		is_tradeable?: boolean;
	}> = [];
	const errors: string[] = [];

	for (const card of cards) {
		const cardResult = await findOrCreateCard(gameSlug, card.name, card.set, card.collector_number);

		if (!cardResult) {
			errors.push(`Card not found: ${card.name}`);
			continue;
		}

		let printingId: string | null = card.cardPrintingId || null;

		if (!printingId && card.set && card.collector_number) {
			const match = cardResult.printings.find(
				(p) => p.setCode === card.set && p.collectorNumber === card.collector_number
			);
			if (match) printingId = match.id;
		}

		if (!printingId && cardResult.printings.length > 0) {
			printingId = cardResult.printings[0].id;
		}

		if (!printingId) {
			errors.push(`No printing found for: ${card.name}`);
			continue;
		}

		resolved.push({
			card_printing_id: printingId,
			quantity: card.qty,
			condition: card.condition || 'NM',
			is_foil: card.isFoil || false,
			is_signed: card.isSigned || false,
			is_altered: card.isAltered || false,
			language: card.language || 'en',
			is_tradeable: card.isTradeable !== undefined ? card.isTradeable : true
		});
	}

	return { resolved, errors };
}

export const GET: RequestHandler = async (event) => {
	const { url } = event;
	const clerkUserId = await requireAuth(event);
	const gameSlug = url.searchParams.get('game') || 'mtg';
	const cards = await getCollection(clerkUserId, gameSlug);
	return json({ success: true, data: { cards } });
};

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	const clerkUserId = await requireAuth(event);
	const rateCheck = apiRateLimiter({
		request,
		getClientAddress: () => request.headers.get('x-forwarded-for') || 'unknown'
	} as unknown as RequestEvent);
	if (!rateCheck.passed) return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);

	const body = await request.json();
	const gameSlug = body.gameSlug || 'mtg';

	const { data: game } = await supabase.from('games').select('id').eq('slug', gameSlug).single();

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
	const clerkUserId = await requireAuth(event);
	const gameSlug = url.searchParams.get('game') || undefined;
	await clearCollection(clerkUserId, gameSlug);
	return json({ success: true });
};
