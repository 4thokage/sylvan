import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async () => {
	const hasServiceKey = !!env.SUPABASE_SERVICE_ROLE_KEY;
	const hasAnonKey = !!env.SUPABASE_ANON_KEY;
	const hasUrl = !!env.SUPABASE_URL;

	let dbStatus = 'unknown';
	let games = [];
	let users = [];

	try {
		const { data: gamesData, error: gamesError } = await supabase
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

	try {
		const { data: usersData, error: usersError } = await supabase
			.from('users')
			.select('id, username')
			.limit(1);
		if (usersError) {
			dbStatus = dbStatus === 'unknown' ? `users error: ${usersError.message}` : dbStatus;
		} else {
			users = usersData || [];
		}
	} catch (err) {
		dbStatus =
			dbStatus === 'unknown'
				? `users exception: ${err instanceof Error ? err.message : String(err)}`
				: dbStatus;
	}

	return json({
		env: {
			hasServiceKey,
			hasAnonKey,
			hasUrl,
			keyPrefix: env.SUPABASE_SERVICE_ROLE_KEY
				? env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 20) + '...'
				: env.SUPABASE_ANON_KEY
					? env.SUPABASE_ANON_KEY.slice(0, 20) + '...'
					: 'none'
		},
		db: {
			status: dbStatus,
			games,
			users
		}
	});
};
