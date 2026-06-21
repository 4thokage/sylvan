import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { apiRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { requireAuth } from '$lib/server/middleware/auth';

export const POST: RequestHandler = async (event) => {
	const clerkUserId = await requireAuth(event);
	const rateCheck = apiRateLimiter(event);
	if (!rateCheck.passed) {
		return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);
	}

	try {
		const { data: existing } = await supabase
			.from('users')
			.select('id, username, display_name, is_admin')
			.eq('clerk_user_id', clerkUserId)
			.single();

		if (existing) {
			return json({ success: true, data: { user: existing, created: false } });
		}

		const suggestedName = `user-${clerkUserId.slice(0, 8)}`;

		const { data: created, error } = await supabase
			.from('users')
			.insert({
				clerk_user_id: clerkUserId,
				username: suggestedName,
				display_name: null,
				is_public: false
			})
			.select('id, username, display_name, is_admin')
			.single();

		if (error) {
			return json({ success: false, error: { message: error.message } }, { status: 500 });
		}

		return json({ success: true, data: { user: created, created: true } });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to sync user';
		return json({ success: false, error: { message } }, { status: 500 });
	}
};
