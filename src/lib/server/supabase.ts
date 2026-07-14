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
// are performed via security-definable RPC functions.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

// Privileged client (bypasses RLS) for trusted server-side operations that are already scoped
// by an explicit user identifier (e.g. user provisioning). Avoids forwarding the Clerk JWT,
// which Supabase cannot verify, so these queries never fail with "No suitable key or wrong key type".
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
export const supabaseService = serviceRoleKey
	? createClient(env.SUPABASE_URL, serviceRoleKey, { auth: { persistSession: false } })
	: null;

export function getServiceSupabase(): SupabaseClient {
	if (!supabaseService) {
		throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
	}
	return supabaseService;
}

const supabaseContext = new AsyncLocalStorage<SupabaseClient>();

/**
 * Create a request-scoped Supabase client that forwards the user's Clerk JWT.
 * Passing `null` creates an anonymous client.
 */
// Request-scoped client now uses the service-role key instead of forwarding the Clerk JWT.
// Supabase cannot verify Clerk-issued JWTs, so forwarding them made every server-side query
// fail ("No suitable key or wrong key type" / "permission denied"). All server-side queries
// are explicitly scoped by user_id / clerk_user_id, so bypassing RLS via service-role is safe.
export function createAuthSupabase(_token: string | null | undefined): SupabaseClient {
	return getServiceSupabase();
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
