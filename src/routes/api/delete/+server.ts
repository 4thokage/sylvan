import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { apiRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { requireAuth } from '$lib/server/middleware/auth';
import { deleteWishlist } from '$lib/server/services/wishlist.service';

export const DELETE: RequestHandler = async (event) => {
	const { request } = event;
	const clerkUserId = await requireAuth(event);
	if (typeof clerkUserId !== 'string') return clerkUserId;
	const rateCheck = apiRateLimiter({
		request,
		getClientAddress: () => request.headers.get('x-forwarded-for') || 'unknown'
	} as any);
	if (!rateCheck.passed) {
		return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);
	}

	try {
		const url = new URL(request.url);
		const id = url.searchParams.get('id');
		const fingerprint = url.searchParams.get('fingerprint');

		if (!id) {
			return json({ success: false, error: { message: 'Missing id' } }, { status: 400 });
		}

		await deleteWishlist(id, fingerprint || undefined, clerkUserId);
		return json({ success: true });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to delete wishlist';
		return json({ success: false, error: { message } }, { status: 400 });
	}
};
