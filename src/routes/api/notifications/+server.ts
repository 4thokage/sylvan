import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/middleware/auth';
import { getServiceSupabase } from '$lib/server/supabase';

export const GET: RequestHandler = async (event) => {
	const authUser = await requireUser(event);
	if (!('clerkUserId' in authUser)) return authUser;

	const { data: notifications } = await 	getServiceSupabase()
		.from('notifications')
		.select('*')
		.eq('user_id', authUser.dbUserId)
		.order('created_at', { ascending: false })
		.limit(50);

	const unreadCount = (notifications || []).filter((n) => !n.read_at).length;

	return json({
		success: true,
		data: { userId: authUser.dbUserId, notifications: notifications || [], unreadCount }
	});
};

export const PATCH: RequestHandler = async (event) => {
	const authUser = await requireUser(event);
	if (!('clerkUserId' in authUser)) return authUser;

	const { error } = await 	getServiceSupabase()
		.from('notifications')
		.update({ read_at: new Date().toISOString() })
		.eq('user_id', authUser.dbUserId)
		.is('read_at', null);

	if (error) {
		return json({ success: false, error: { message: error.message } }, { status: 500 });
	}

	return json({ success: true });
};
