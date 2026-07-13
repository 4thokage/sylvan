import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { SaveWishlistSchema, type SaveWishlistInput } from '$lib/schemas/api';
import { saveRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { getOptionalAuth } from '$lib/server/middleware/auth';
import { ensureUser } from '$lib/server/services/user.service';
import { resolveCards } from '$lib/server/services/card-resolver.service';
import { createWishlist } from '$lib/server/services/wishlist.service';
import { getSupabase } from '$lib/server/supabase';

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

		// Ensure a `users` row exists for signed-in creators so the wishlist can
		// be linked and later edited/owned (the page-load sync is not guaranteed
		// for SPA fetches).
		if (clerkUserId) {
			await ensureUser(clerkUserId);
		}

		const { cards, creatorFingerprint, ownerName, gameSlug } = parsed.data as SaveWishlistInput;

		const gameSlugValue = gameSlug || 'mtg';
		const { data: game } = await getSupabase()
			.from('games')
			.select('id')
			.eq('slug', gameSlugValue)
			.single();

		if (!game) {
			return json({ success: false, error: { message: 'Game not found' } }, { status: 400 });
		}

		const cardResults = await resolveCards(
			gameSlugValue,
			cards.map((c) => ({
				name: c.name,
				qty: c.qty,
				set: c.set,
				collectorNumber: c.collector_number,
				finish: c.finish || undefined,
				cardPrintingId: c.cardPrintingId || undefined
			}))
		);
		if (cardResults.errors.length > 0) {
			return json({ success: false, error: { message: cardResults.errors[0] } }, { status: 400 });
		}

		const resolvedCards = cardResults.resolved.map((c) => {
			const input = cards.find((cr) => cr.name === c.cardName);
			return {
				card_id: c.cardId,
				qty: c.qty,
				card_printing_id: c.printingId,
				condition: input?.condition || null,
				finish: input?.finish || null,
				aftermarket_signed: input?.aftermarketSigned ?? null,
				is_altered: input?.isAltered ?? null,
				language: input?.language || null
			};
		});

		const id = await createWishlist({
			cards: resolvedCards,
			creatorFingerprint: creatorFingerprint || undefined,
			ownerName: ownerName || null,
			clerkUserId: clerkUserId || undefined,
			gameSlug: gameSlugValue,
			visibility: 'public'
		});

		return json({ success: true, data: { id } });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to save wishlist';
		return json({ success: false, error: { message } }, { status: 400 });
	}
};
