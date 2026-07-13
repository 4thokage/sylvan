import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { apiRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import {
	createTradeProposal,
	getTradesForUser,
	findMatchesForCollection
} from '$lib/server/services/trade.service';
import { getCollection } from '$lib/server/services/collection.service';
import { listPublicWishlists } from '$lib/server/services/wishlist.service';
import { requireAuth, getOptionalAuth } from '$lib/server/middleware/auth';
import { TradeProposalSchema } from '$lib/schemas/api';
import { tradeRepository } from '$lib/server/repositories/trade.repository';

export const GET: RequestHandler = async (event) => {
	const rateCheck = apiRateLimiter(event);
	if (!rateCheck.passed) {
		return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);
	}

	try {
		const clerkUserId = await getOptionalAuth(event);

		if (!clerkUserId) {
			const wishlists = await listPublicWishlists(50, 0);
			return json({ success: true, data: { wishlists } });
		}

		const [trades, collection] = await Promise.all([
			getTradesForUser(clerkUserId),
			getCollection(clerkUserId)
		]);

		const userId = await tradeRepository.getUserIdByClerkId(clerkUserId);

		const matches = await findMatchesForCollection(
			userId,
			collection.map((c) => ({
				id: c.id,
				cardPrintingId: c.cardPrintingId,
				cardName: c.cardName,
				quantity: c.quantity,
				condition: c.condition,
				finish: c.finish,
				aftermarketSigned: c.aftermarketSigned,
				isAltered: c.isAltered,
				language: c.language,
				isTradeable: c.isTradeable,
				marketPriceEur: c.marketPriceEur
			}))
		);

		return json({
			success: true,
			data: { trades, matches, userId }
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to load trades';
		return json({ success: false, error: { message } }, { status: 500 });
	}
};

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	const clerkUserId = await requireAuth(event);
	if (typeof clerkUserId !== 'string') return clerkUserId;
	const rateCheck = apiRateLimiter(event);
	if (!rateCheck.passed) return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);

	try {
		const body = await request.json();
		const parsed = TradeProposalSchema.safeParse(body);
		if (!parsed.success) {
			return json(
				{
					success: false,
					error: { message: parsed.error.issues.map((i) => i.message).join(', ') }
				},
				{ status: 400 }
			);
		}

		const trade = await createTradeProposal(
			clerkUserId,
			parsed.data.recipientId,
			parsed.data.offeredItems,
			parsed.data.requestedItems,
			parsed.data.note
		);

		return json({ success: true, data: { trade } });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to create trade';
		return json({ success: false, error: { message } }, { status: 500 });
	}
};
