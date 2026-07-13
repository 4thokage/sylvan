import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { apiRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';

export const GET: RequestHandler = async (event) => {
	const { params } = event;
	const rateCheck = apiRateLimiter(event);
	if (!rateCheck.passed) {
		return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);
	}

	try {
		const { data, error } = await getSupabase().rpc('get_public_profile', {
			p_user_id: params.id
		});

		if (error) {
			return json({ success: false, error: { message: error.message } }, { status: 400 });
		}

		return json({ success: true, data });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to load profile';
		return json({ success: false, error: { message } }, { status: 500 });
	}
};
