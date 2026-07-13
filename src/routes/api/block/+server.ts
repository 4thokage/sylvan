import type { RequestHandler } from './$types';
import type { RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { apiRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { requireAuth } from '$lib/server/middleware/auth';
import { getSupabase } from '$lib/server/supabase';
import { z } from 'zod/v4';

const BlockSchema = z.object({
	blockedId: z.string().uuid()
});

export const GET: RequestHandler = async (event) => {
	const clerkUserId = await requireAuth(event);
	if (typeof clerkUserId !== 'string') return clerkUserId;

	const { data: user } = await getSupabase()
		.from('users')
		.select('id')
		.eq('clerk_user_id', clerkUserId)
		.single();

	if (!user) {
		return json({ success: false, error: { message: 'User not found' } }, { status: 404 });
	}

	const { data: blocked } = await getSupabase()
		.from('blocked_users')
		.select('blocked_id, blocked:blocked_id(id, username)')
		.eq('blocker_id', user.id);

	return json({ success: true, data: { blocked: blocked || [] } });
};

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	const clerkUserId = await requireAuth(event);
	if (typeof clerkUserId !== 'string') return clerkUserId;
	const rateCheck = apiRateLimiter({
		request,
		getClientAddress: () => request.headers.get('x-forwarded-for') || 'unknown'
	} as unknown as RequestEvent);
	if (!rateCheck.passed) return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);

	const { data: user } = await getSupabase()
		.from('users')
		.select('id')
		.eq('clerk_user_id', clerkUserId)
		.single();

	if (!user) {
		return json({ success: false, error: { message: 'User not found' } }, { status: 404 });
	}

	const body = await request.json();
	const parsed = BlockSchema.safeParse(body);
	if (!parsed.success) {
		return json(
			{ success: false, error: { message: parsed.error.issues.map((i) => i.message).join(', ') } },
			{ status: 400 }
		);
	}

	if (parsed.data.blockedId === user.id) {
		return json({ success: false, error: { message: 'Cannot block yourself' } }, { status: 400 });
	}

	const { error } = await getSupabase().from('blocked_users').upsert(
		{
			blocker_id: user.id,
			blocked_id: parsed.data.blockedId
		},
		{ onConflict: 'blocker_id,blocked_id' }
	);

	if (error) {
		return json({ success: false, error: { message: error.message } }, { status: 500 });
	}

	return json({ success: true });
};

export const DELETE: RequestHandler = async (event) => {
	const { request } = event;
	const clerkUserId = await requireAuth(event);
	if (typeof clerkUserId !== 'string') return clerkUserId;

	const { data: user } = await getSupabase()
		.from('users')
		.select('id')
		.eq('clerk_user_id', clerkUserId)
		.single();

	if (!user) {
		return json({ success: false, error: { message: 'User not found' } }, { status: 404 });
	}

	const body = await request.json();
	const parsed = BlockSchema.safeParse(body);
	if (!parsed.success) {
		return json(
			{ success: false, error: { message: parsed.error.issues.map((i) => i.message).join(', ') } },
			{ status: 400 }
		);
	}

	const { error } = await getSupabase()
		.from('blocked_users')
		.delete()
		.eq('blocker_id', user.id)
		.eq('blocked_id', parsed.data.blockedId);

	if (error) {
		return json({ success: false, error: { message: error.message } }, { status: 500 });
	}

	return json({ success: true });
};
