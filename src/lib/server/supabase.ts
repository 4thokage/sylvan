import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AsyncLocalStorage } from 'node:async_hooks';
import { env } from '$env/dynamic/private';

if (!env.SUPABASE_URL) {
	throw new Error('Missing SUPABASE_URL environment variable');
}

if (!env.SUPABASE_ANON_KEY) {
	throw new Error('Missing SUPABASE_ANON_KEY environment variable');
}

// Server-side Supabase client uses the anon key + Clerk JWT so Row Level Security is enforced.
// Complex operations that cross ownership boundaries (trade lifecycle, anonymous wishlist ops)
// are performed via security-definer RPC functions.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

const supabaseContext = new AsyncLocalStorage<SupabaseClient>();

/**
 * Create a request-scoped Supabase client that forwards the user's Clerk JWT.
 * Passing `null` creates an anonymous client.
 */
export function createAuthSupabase(token: string | null | undefined): SupabaseClient {
	return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
		global: {
			headers: token ? { Authorization: `Bearer ${token}` } : {}
		}
	});
}

/**
 * Returns the Supabase client for the current request.
 * Falls back to the global anonymous client when called outside a request context.
 */
export function getSupabase(): SupabaseClient {
	return supabaseContext.getStore() ?? supabase;
}

/**
 * Run a function with a request-scoped Supabase client.
 */
export function runWithSupabase<T>(client: SupabaseClient, fn: () => T): T {
	return supabaseContext.run(client, fn);
}
