import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { requireAuth } from '$lib/server/middleware/auth';

export const GET: RequestHandler = async (event) => {
	const clerkUserId = await requireAuth(event);
	if (typeof clerkUserId !== 'string') return clerkUserId;

	const { data: user } = await getSupabase()
		.from('users')
		.select('is_admin')
		.eq('clerk_user_id', clerkUserId)
		.single();

	if (!user?.is_admin) {
		return json({ success: false, error: { message: 'Forbidden' } }, { status: 403 });
	}

	let dbStatus = 'unknown';
	let games: Array<{ slug: string; name: string }> = [];

	try {
		const { data: gamesData, error: gamesError } = await getSupabase()
			.from('games')
			.select('slug, name');
		if (gamesError) {
			dbStatus = `games error: ${gamesError.message}`;
		} else {
			games = gamesData || [];
		}
	} catch (err) {
		dbStatus = `games exception: ${err instanceof Error ? err.message : String(err)}`;
	}

	return json({
		env: {
			hasUrl: !!process.env.SUPABASE_URL
		},
		db: {
			status: dbStatus,
			games
		}
	});
};
