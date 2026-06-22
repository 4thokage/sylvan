import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { apiRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { requireAuth } from '$lib/server/middleware/auth';
import { supabase } from '$lib/server/supabase';
import { MessageSchema } from '$lib/schemas/api';

export const GET: RequestHandler = async (event) => {
	const { url } = event;
	const clerkUserId = await requireAuth(event);
	if (typeof clerkUserId !== 'string') return clerkUserId;

	const { data: user } = await supabase
		.from('users')
		.select('id')
		.eq('clerk_user_id', clerkUserId)
		.single();

	if (!user) {
		return json({ success: false, error: { message: 'User not found' } }, { status: 404 });
	}

	const tradeId = url.searchParams.get('tradeId');

	let query = supabase
		.from('messages')
		.select('*, sender:sender_id(id, username)')
		.or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
		.order('created_at', { ascending: false })
		.limit(100);

	if (tradeId) {
		query = query.eq('trade_id', tradeId);
	}

	const { data: messages } = await query;

	return json({ success: true, data: { messages: messages || [] } });
};

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	const clerkUserId = await requireAuth(event);
	if (typeof clerkUserId !== 'string') return clerkUserId;
	const rateCheck = apiRateLimiter({
		request,
		getClientAddress: () => request.headers.get('x-forwarded-for') || 'unknown'
	} as any);
	if (!rateCheck.passed) return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);

	const { data: user } = await supabase
		.from('users')
		.select('id')
		.eq('clerk_user_id', clerkUserId)
		.single();

	if (!user) {
		return json({ success: false, error: { message: 'User not found' } }, { status: 404 });
	}

	const body = await request.json();
	const parsed = MessageSchema.safeParse(body);
	if (!parsed.success) {
		return json(
			{ success: false, error: { message: parsed.error.issues.map((i) => i.message).join(', ') } },
			{ status: 400 }
		);
	}

	const { error } = await supabase.from('messages').insert({
		sender_id: user.id,
		recipient_id: parsed.data.recipientId,
		trade_id: parsed.data.tradeId || null,
		subject: parsed.data.subject || null,
		body: parsed.data.body
	});

	if (error) {
		return json({ success: false, error: { message: error.message } }, { status: 500 });
	}

	return json({ success: true });
};
