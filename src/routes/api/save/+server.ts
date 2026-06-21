import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { SaveWishlistSchema } from '$lib/schemas/api';
import { saveRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { getOptionalAuth } from '$lib/server/middleware/auth';
import { createWishlist } from '$lib/server/services/wishlist.service';
import { findOrCreateCard } from '$lib/server/services/card.service';
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

		const resolvedCards: Array<{
			card_id: string;
			qty: number;
			card_printing_id?: string | null;
			condition?: string;
			is_foil?: boolean;
			is_signed?: boolean;
			is_altered?: boolean;
			language?: string;
		}> = [];

		for (const card of cards) {
			const cardResult = await findOrCreateCard(
				gameSlugValue,
				card.name,
				card.set,
				card.collector_number,
				card.oracleId || null
			);

			if (!cardResult) {
				return json(
					{
						success: false,
						error: { message: `Card not found: ${card.name}` }
					},
					{ status: 400 }
				);
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

			resolvedCards.push({
				card_id: cardResult.id,
				qty: card.qty,
				card_printing_id: printingId,
				condition: card.condition || 'NM',
				is_foil: card.isFoil || false,
				is_signed: card.isSigned || false,
				is_altered: card.isAltered || false,
				language: card.language || 'en'
			});
		}

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
