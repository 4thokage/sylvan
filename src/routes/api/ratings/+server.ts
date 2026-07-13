import type { RequestHandler } from './$types';
import type { RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { apiRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { requireAuth } from '$lib/server/middleware/auth';
import { getSupabase } from '$lib/server/supabase';
import { z } from 'zod/v4';

const CreateRatingSchema = z.object({
	tradeId: z.string().uuid(),
	ratedUserId: z.string().uuid(),
	rating: z.number().int().min(1).max(5),
	comment: z.string().max(2000).optional()
});

export const GET: RequestHandler = async ({ url }) => {
	const userId = url.searchParams.get('userId');
	if (!userId) {
		return json(
			{ success: false, error: { message: 'userId parameter required' } },
			{ status: 400 }
		);
	}

	const { data: ratings } = await getSupabase()
		.from('trade_ratings')
		.select('*, rater:rater_id!users(id, username)')
		.eq('rated_id', userId)
		.order('created_at', { ascending: false })
		.limit(50);

	const avgResult = await getSupabase()
		.from('trade_ratings')
		.select('rating')
		.eq('rated_id', userId);

	const allRatings = avgResult.data || [];
	const averageRating =
		allRatings.length > 0
			? (allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length).toFixed(1)
			: null;

	return json({
		success: true,
		data: { ratings: ratings || [], averageRating, totalRatings: allRatings.length }
	});
};

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	const clerkUserId = await requireAuth(event);
	if (typeof clerkUserId !== 'string') return clerkUserId;
	const rateCheck = apiRateLimiter({
		request,
		getClientAddress: () => request.headers.get('x-forwarded-for') || 'unknown'
	} as unknown as RequestEvent);
	if (!rateCheck.passed) return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);

	const { data: user } = await getSupabase()
		.from('users')
		.select('id')
		.eq('clerk_user_id', clerkUserId)
		.single();

	if (!user) {
		return json({ success: false, error: { message: 'User not found' } }, { status: 404 });
	}

	const body = await request.json();
	const parsed = CreateRatingSchema.safeParse(body);
	if (!parsed.success) {
		return json(
			{ success: false, error: { message: parsed.error.issues.map((i) => i.message).join(', ') } },
			{ status: 400 }
		);
	}

	if (parsed.data.ratedUserId === user.id) {
		return json({ success: false, error: { message: 'Cannot rate yourself' } }, { status: 400 });
	}

	const { error } = await getSupabase().rpc('create_trade_rating', {
		p_trade_id: parsed.data.tradeId,
		p_rated_id: parsed.data.ratedUserId,
		p_rating: parsed.data.rating,
		p_comment: parsed.data.comment || null
	});

	if (error) {
		return json({ success: false, error: { message: error.message } }, { status: 400 });
	}

	return json({ success: true });
};
