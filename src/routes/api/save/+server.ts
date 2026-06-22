import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { SaveWishlistSchema } from '$lib/schemas/api';
import { saveRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { getOptionalAuth } from '$lib/server/middleware/auth';
import { resolveCards } from '$lib/server/services/card-resolver.service';
import { createWishlist } from '$lib/server/services/wishlist.service';
import { supabase } from '$lib/server/supabase';

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	const clerkUserId = await getOptionalAuth(event);
	const rateCheck = saveRateLimiter(event);
	if (!rateCheck.passed) {
		return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);
	}

	try {
		const body = await request.json();
		const parsed = SaveWishlistSchema.safeParse(body);
		if (!parsed.success) {
			return json(
				{ success: false, error: { message: 'Invalid input', details: parsed.error.issues } },
				{ status: 400 }
			);
		}

		const { cards, creatorFingerprint, ownerName, gameSlug } = parsed.data;

		const gameSlugValue = gameSlug || 'mtg';
		const { data: game } = await supabase
			.from('games')
			.select('id')
			.eq('slug', gameSlugValue)
			.single();

		if (!game) {
			return json({ success: false, error: { message: 'Game not found' } }, { status: 400 });
		}

		const cardResults = await resolveCards(
			gameSlugValue,
			cards.map((c: Record<string, unknown>) => ({
				name: c.name as string,
				qty: c.qty as number,
				set: c.set as string | undefined,
				collectorNumber: c.collector_number as string | undefined,
				oracleId: (c.oracleId as string | null) || undefined,
				cardPrintingId: c.cardPrintingId as string | null | undefined
			}))
		);
		if (cardResults.errors.length > 0) {
			return json({ success: false, error: { message: cardResults.errors[0] } }, { status: 400 });
		}

		const resolvedCards = cardResults.resolved.map((c) => {
			const input = cards.find((cr: { name: string }) => cr.name === c.cardName);
			return {
				card_id: c.cardId,
				qty: c.qty,
				card_printing_id: c.printingId,
				condition: input?.condition || 'NM',
				is_foil: input?.isFoil || false,
				is_signed: input?.isSigned || false,
				is_altered: input?.isAltered || false,
				language: input?.language || 'en'
			};
		});

		const id = await createWishlist({
			cards: resolvedCards,
			creatorFingerprint: creatorFingerprint || undefined,
			ownerName: ownerName || null,
			clerkUserId: clerkUserId || undefined,
			gameSlug: gameSlugValue
		});

		return json({ success: true, data: { id } });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to save wishlist';
		return json({ success: false, error: { message } }, { status: 400 });
	}
};
