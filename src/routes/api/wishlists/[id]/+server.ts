import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { apiRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';

export const GET: RequestHandler = async (event) => {
	const { params } = event;
	const rateCheck = apiRateLimiter(event);
	if (!rateCheck.passed) {
		return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);
	}

	try {
		const { data: wishlist } = await supabase
			.from('wishlists')
			.select('*')
			.eq('id', params.id)
			.single();

		if (!wishlist) {
			return json({ success: false, error: { message: 'Wishlist not found' } }, { status: 404 });
		}

		const { data: items } = await supabase
			.from('wishlist_items')
			.select('*')
			.eq('wishlist_id', params.id);

		return json({
			success: true,
			data: {
				...wishlist,
				cards: items || []
			}
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to load wishlist';
		return json({ success: false, error: { message } }, { status: 500 });
	}
};
