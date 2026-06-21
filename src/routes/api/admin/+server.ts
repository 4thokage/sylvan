import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/middleware/auth';
import { supabase } from '$lib/server/supabase';

export const GET: RequestHandler = async (event) => {
	const clerkUserId = await requireAuth(event);

	const { data: user } = await supabase
		.from('users')
		.select('id, is_admin')
		.eq('clerk_user_id', clerkUserId)
		.single();

	if (!user || !user.is_admin) {
		return json({ success: false, error: { message: 'Not authorized' } }, { status: 403 });
	}

	const [usersResult, tradesResult, cardsResult] = await Promise.all([
		supabase
			.from('users')
			.select('id, display_name, username, is_public, is_admin, created_at')
			.order('created_at', { ascending: false })
			.limit(100),
		supabase
			.from('trades')
			.select('id, status, created_at')
			.order('created_at', { ascending: false })
			.limit(100),
		supabase.from('user_cards').select('count', { count: 'exact', head: true })
	]);

	return json({
		success: true,
		data: {
			users: usersResult.data || [],
			trades: tradesResult.data || [],
			stats: {
				totalUsers: usersResult.data?.length || 0,
				totalTrades: tradesResult.data?.length || 0,
				totalCollectionCards: cardsResult.count || 0,
				tradesByStatus: (tradesResult.data || []).reduce<Record<string, number>>((acc, t) => {
					acc[t.status] = (acc[t.status] || 0) + 1;
					return acc;
				}, {})
			}
		}
	});
};
