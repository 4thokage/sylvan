import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { apiRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { listUserWishlists } from '$lib/server/services/wishlist.service';

export const GET: RequestHandler = async (event) => {
	const { locals } = event;
	const rateCheck = apiRateLimiter(event);
	if (!rateCheck.passed) {
		return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);
	}

	const clerkUserId = locals?.clerkUserId;
	if (!clerkUserId) {
		return json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
	}

	try {
		const wishlists = await listUserWishlists(clerkUserId, 50, 0);
		return json({ success: true, data: { wishlists } });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to load wishlists';
		return json({ success: false, error: { message } }, { status: 500 });
	}
};
