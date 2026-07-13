import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/middleware/auth';
import { getSupabase } from '$lib/server/supabase';

export const GET: RequestHandler = async (event) => {
	const clerkUserId = await requireAuth(event);
	if (typeof clerkUserId !== 'string') return clerkUserId;

	const { data: user } = await getSupabase()
		.from('users')
		.select('id, is_admin')
		.eq('clerk_user_id', clerkUserId)
		.single();

	if (!user || !user.is_admin) {
		return json({ success: false, error: { message: 'Not authorized' } }, { status: 403 });
	}

	const { data: raw, error } = await getSupabase().rpc('admin_dashboard_stats').single();
	if (error || !raw) {
		return json(
			{ success: false, error: { message: error?.message || 'Failed to load admin data' } },
			{ status: 500 }
		);
	}

	const data = raw as Record<string, unknown>;
	const trades = (data.recent_trades || []) as Array<{ status: string }>;

	return json({
		success: true,
		data: {
			users: data.recent_users || [],
			trades: data.recent_trades || [],
			stats: {
				totalUsers: Number(data.total_users) || 0,
				totalTrades: Number(data.total_trades) || 0,
				totalCollectionCards: Number(data.total_collection_cards) || 0,
				tradesByStatus: trades.reduce<Record<string, number>>(
					(acc: Record<string, number>, t: { status: string }) => {
						acc[t.status] = (acc[t.status] || 0) + 1;
						return acc;
					},
					{}
				)
			}
		}
	});
};
