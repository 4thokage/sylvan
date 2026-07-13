import type { RequestHandler } from './$types';
import type { RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { apiRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { requireAuth } from '$lib/server/middleware/auth';
import { getSupabase } from '$lib/server/supabase';
import { z } from 'zod/v4';

const UpgradeSchema = z.object({
	fingerprint: z.string().min(1).max(256)
});

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	const clerkUserId = await requireAuth(event);
	if (typeof clerkUserId !== 'string') return clerkUserId;
	const rateCheck = apiRateLimiter({
		request,
		getClientAddress: () => request.headers.get('x-forwarded-for') || 'unknown'
	} as unknown as RequestEvent);
	if (!rateCheck.passed) return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);

	const body = await request.json();
	const parsed = UpgradeSchema.safeParse(body);
	if (!parsed.success) {
		return json(
			{ success: false, error: { message: parsed.error.issues.map((i) => i.message).join(', ') } },
			{ status: 400 }
		);
	}

	const { fingerprint } = parsed.data;

	const { data: user } = await getSupabase()
		.from('users')
		.select('id')
		.eq('clerk_user_id', clerkUserId)
		.single();

	if (!user) {
		return json({ success: false, error: { message: 'User not found' } }, { status: 404 });
	}

	// Link session to user and migrate anonymous wishlists (enforced by RPC).
	const { error } = await getSupabase().rpc('upgrade_session', {
		p_fingerprint: fingerprint,
		p_user_id: user.id
	});

	if (error) {
		return json({ success: false, error: { message: error.message } }, { status: 400 });
	}

	return json({ success: true, data: { merged: true } });
};
