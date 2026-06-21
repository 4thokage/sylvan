import { buildClerkProps } from 'svelte-clerk/server';
import { supabase } from '$lib/server/supabase';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const auth = await locals.auth();
	const clerkUserId = auth.userId;

	let user = null;

	if (clerkUserId) {
		const { data: existing, error: selectError } = await supabase
			.from('users')
			.select('id, username, display_name, is_admin')
			.eq('clerk_user_id', clerkUserId)
			.single();

		if (selectError && selectError.code !== 'PGRST116') {
			console.error('[Layout] Error fetching user:', selectError.message);
		}

		if (existing) {
			user = existing;
		} else {
			const suggestedName = `user-${clerkUserId.slice(0, 8)}`;
			const { data: created, error: insertError } = await supabase
				.from('users')
				.insert({
					clerk_user_id: clerkUserId,
					username: suggestedName,
					display_name: null,
					is_public: false
				})
				.select('id, username, display_name, is_admin')
				.single();

			if (insertError) {
				console.error('[Layout] Error creating user:', insertError.message);
			} else if (created) {
				user = created;
			}
		}
	}

	return {
		...buildClerkProps(auth),
		user
	};
};
