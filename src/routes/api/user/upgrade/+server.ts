import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { apiRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { requireAuth } from '$lib/server/middleware/auth';
import { supabase } from '$lib/server/supabase';
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
	} as any);
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

	const { data: user } = await supabase
		.from('users')
		.select('id')
		.eq('clerk_user_id', clerkUserId)
		.single();

	if (!user) {
		return json({ success: false, error: { message: 'User not found' } }, { status: 404 });
	}

	// Link session to user
	await supabase
		.from('user_sessions')
		.update({ user_id: user.id, last_seen_at: new Date().toISOString() })
		.eq('fingerprint', fingerprint);

	return json({ success: true, data: { merged: true } });
};
