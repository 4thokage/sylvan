import { withClerkHandler } from 'svelte-clerk/server';
import type { Handle } from '@sveltejs/kit';
import { createAuthSupabase, runWithSupabase } from '$lib/server/supabase';

const clerkHandler = withClerkHandler();

export const handle: Handle = ({ event, resolve }) =>
	clerkHandler({
		event,
		resolve: async (ev) => {
			const auth = ev.locals.auth();
			const token = auth.userId ? await auth.getToken() : null;
			const supabase = createAuthSupabase(token);

			return runWithSupabase(supabase, () => resolve(ev));
		}
	});
