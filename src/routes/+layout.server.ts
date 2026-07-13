import { buildClerkProps } from 'svelte-clerk/server';
import { getSupabase } from '$lib/server/supabase';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const auth = await locals.auth();
	const clerkUserId = auth.userId;

	let user = null;

	if (clerkUserId) {
		const { data: userId, error: rpcError } = await getSupabase().rpc('ensure_user', {
			p_clerk_user_id: clerkUserId
		});

		if (rpcError) {
			console.error('[Layout] Error ensuring user:', rpcError.message);
		} else if (userId) {
			const { data: profile } = await getSupabase()
				.from('users')
				.select('id, username, is_admin')
				.eq('id', userId)
				.single();
			user = profile || null;
		}
	}

	return {
		...buildClerkProps(auth),
		user
	};
};
