import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { apiRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { requireAuth } from '$lib/server/middleware/auth';
import { supabase } from '$lib/server/supabase';
import { z } from 'zod/v4';

const UpdateTradeStatusSchema = z.object({
	status: z.enum(['accepted', 'rejected', 'cancelled'])
});

const CounterOfferSchema = z.object({
	action: z.literal('counter'),
	offeredCardIds: z.array(z.string().uuid()).min(1).max(200),
	requestedCardIds: z.array(z.string().uuid()).min(1).max(200),
	note: z.string().max(2000).optional()
});

export const GET: RequestHandler = async (event) => {
	const { params } = event;
	const clerkUserId = await requireAuth(event);
	try {
		const trade = await getTradeById(params.id);
		if (!trade) {
			return json({ success: false, error: { message: 'Trade not found' } }, { status: 404 });
		}
		return json({ success: true, data: { trade } });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to load trade';
		return json({ success: false, error: { message } }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async (event) => {
	const { params, request } = event;
	const clerkUserId = await requireAuth(event);
	const rateCheck = apiRateLimiter({
		request,
		getClientAddress: () => request.headers.get('x-forwarded-for') || 'unknown'
	} as any);
	if (!rateCheck.passed) return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);

	try {
		const body = await request.json();

		// Check if it's a counter-offer
		const counterParsed = CounterOfferSchema.safeParse(body);
		if (counterParsed.success) {
			const result = await createCounterOffer(
				clerkUserId,
				params.id,
				counterParsed.data.offeredCardIds,
				counterParsed.data.requestedCardIds,
				counterParsed.data.note
			);
			return json({ success: true, data: result });
		}

		// Otherwise it's a status update
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
