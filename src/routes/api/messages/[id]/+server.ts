import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/middleware/auth';
import { getSupabase } from '$lib/server/supabase';

export const PATCH: RequestHandler = async (event) => {
	const { params } = event;
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

	const { error } = await getSupabase()
		.from('messages')
		.update({ read_at: new Date().toISOString() })
		.eq('id', params.id)
		.eq('recipient_id', user.id);

	if (error) {
		return json({ success: false, error: { message: error.message } }, { status: 500 });
	}

	return json({ success: true });
};
