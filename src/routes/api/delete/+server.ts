import type { RequestHandler } from './$types';
import type { RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { apiRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { getOptionalAuth } from '$lib/server/middleware/auth';
import { deleteWishlist } from '$lib/server/services/wishlist.service';

export const DELETE: RequestHandler = async (event) => {
	const { request } = event;
	const clerkUserId = await getOptionalAuth(event);
	const rateCheck = apiRateLimiter({
		request,
		getClientAddress: () => request.headers.get('x-forwarded-for') || 'unknown'
	} as unknown as RequestEvent);
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

		if (!clerkUserId && !fingerprint) {
			return json(
				{ success: false, error: { message: 'Authentication or fingerprint required' } },
				{ status: 401 }
			);
		}

		await deleteWishlist(id, fingerprint || undefined, clerkUserId || undefined);
		return json({ success: true });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to delete wishlist';
		return json({ success: false, error: { message } }, { status: 400 });
	}
};
