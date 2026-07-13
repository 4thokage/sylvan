import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { apiRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { requireAuth } from '$lib/server/middleware/auth';

export const POST: RequestHandler = async (event) => {
	const clerkUserId = await requireAuth(event);
	if (typeof clerkUserId !== 'string') return clerkUserId;
	const rateCheck = apiRateLimiter(event);
	if (!rateCheck.passed) {
		return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);
	}

	try {
		const { data: userId, error: rpcError } = await getSupabase().rpc('ensure_user', {
			p_clerk_user_id: clerkUserId
		});

		if (rpcError || !userId) {
			return json(
				{ success: false, error: { message: rpcError?.message || 'Failed to sync user' } },
				{ status: 500 }
			);
		}

		const { data: user, error: selectError } = await getSupabase()
			.from('users')
			.select('id, username, is_admin')
			.eq('id', userId)
			.single();

		if (selectError || !user) {
			return json(
				{ success: false, error: { message: selectError?.message || 'Failed to load user' } },
				{ status: 500 }
			);
		}

		return json({ success: true, data: { user, created: true } });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to sync user';
		return json({ success: false, error: { message } }, { status: 500 });
	}
};
