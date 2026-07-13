import type { RequestHandler } from './$types';
import type { RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { apiRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { requireAuth } from '$lib/server/middleware/auth';
import {
	getTradeDetails,
	getCounterpartyStacks,
	updateTradeStatus,
	createCounterOffer
} from '$lib/server/services/trade.service';
import { tradeRepository } from '$lib/server/repositories/trade.repository';
import { z } from 'zod/v4';

const StatusUpdateSchema = z.object({
	action: z.enum(['accept', 'reject', 'cancel'])
});

const TradeItemSchema = z.object({
	userCardId: z.string().uuid(),
	quantity: z.number().int().min(1).max(99999)
});

const CounterOfferSchema = z.object({
	action: z.literal('counter'),
	offeredItems: z.array(TradeItemSchema).min(1).max(200),
	requestedItems: z.array(TradeItemSchema).max(200).default([]),
	note: z.string().max(2000).optional()
});

export const GET: RequestHandler = async (event) => {
	const { params } = event;
	const clerkUserId = await requireAuth(event);
	if (typeof clerkUserId !== 'string') return clerkUserId;
	try {
		const [trade, counterpartyStacks] = await Promise.all([
			getTradeDetails(params.id),
			getCounterpartyStacks(params.id)
		]);
		if (!trade) {
			return json({ success: false, error: { message: 'Trade not found' } }, { status: 404 });
		}
		const userId = await tradeRepository.getUserIdByClerkId(clerkUserId);
		return json({ success: true, data: { trade, counterpartyStacks, userId } });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to load trade';
		return json({ success: false, error: { message } }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async (event) => {
	const { params, request } = event;
	const clerkUserId = await requireAuth(event);
	if (typeof clerkUserId !== 'string') return clerkUserId;
	const rateCheck = apiRateLimiter({
		request,
		getClientAddress: () => request.headers.get('x-forwarded-for') || 'unknown'
	} as unknown as RequestEvent);
	if (!rateCheck.passed) return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);

	try {
		const body = await request.json();

		const counterParsed = CounterOfferSchema.safeParse(body);
		if (counterParsed.success) {
			const result = await createCounterOffer(
				clerkUserId,
				params.id,
				counterParsed.data.offeredItems,
				counterParsed.data.requestedItems,
				counterParsed.data.note
			);
			return json({ success: true, data: result });
		}

		const parsed = StatusUpdateSchema.safeParse(body);
		if (!parsed.success) {
			return json(
				{
					success: false,
					error: { message: parsed.error.issues.map((i) => i.message).join(', ') }
				},
				{ status: 400 }
			);
		}

		const statusMap: Record<string, 'accepted' | 'rejected' | 'cancelled'> = {
			accept: 'accepted',
			reject: 'rejected',
			cancel: 'cancelled'
		};

		const result = await updateTradeStatus(clerkUserId, params.id, statusMap[parsed.data.action]);
		return json({ success: true, data: result });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to update trade';
		return json({ success: false, error: { message } }, { status: 500 });
	}
};
