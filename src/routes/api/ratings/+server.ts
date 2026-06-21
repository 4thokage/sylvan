import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { apiRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { requireAuth } from '$lib/server/middleware/auth';
import { supabase } from '$lib/server/supabase';
import { z } from 'zod/v4';

const CreateRatingSchema = z.object({
	tradeId: z.string().uuid(),
	ratedUserId: z.string().uuid(),
	rating: z.number().int().min(1).max(5),
	comment: z.string().max(2000).optional()
});

export const GET: RequestHandler = async ({ locals, url }) => {
	const userId = url.searchParams.get('userId');
	if (!userId) {
		return json(
			{ success: false, error: { message: 'userId parameter required' } },
			{ status: 400 }
		);
	}

	const { data: ratings } = await supabase
		.from('trade_ratings')
		.select('*, rater:rater_id(id, username)')
		.eq('rated_id', userId)
		.order('created_at', { ascending: false })
		.limit(50);

	const avgResult = await supabase.from('trade_ratings').select('rating').eq('rated_id', userId);

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
	const rateCheck = apiRateLimiter({
		request,
		getClientAddress: () => request.headers.get('x-forwarded-for') || 'unknown'
	} as any);
	if (!rateCheck.passed) return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);

	const { data: user } = await supabase
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

	const { error } = await supabase.from('trade_ratings').upsert(
		{
			trade_id: parsed.data.tradeId,
			rater_id: user.id,
			rated_id: parsed.data.ratedUserId,
			rating: parsed.data.rating,
			comment: parsed.data.comment || null
		},
		{ onConflict: 'trade_id,rater_id' }
	);

	if (error) {
		return json({ success: false, error: { message: error.message } }, { status: 500 });
	}

	return json({ success: true });
};
