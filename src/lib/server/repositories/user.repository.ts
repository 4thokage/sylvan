import { getSupabase } from '$lib/server/supabase';
import type { UserRepository, UserRow } from './types';

export const userRepository: UserRepository = {
	async getUserIdByClerkId(clerkUserId: string) {
		const { data: user } = await getSupabase()
			.from('users')
			.select('id')
			.eq('clerk_user_id', clerkUserId)
			.single();
		return user?.id || null;
	},

	async ensureUser(clerkUserId: string) {
		const { data: existing, error: selectError } = await getSupabase()
			.from('users')
			.select('id, username')
			.eq('clerk_user_id', clerkUserId)
			.single();

		if (selectError && selectError.code !== 'PGRST116') throw new Error(selectError.message);
		if (existing) return existing as UserRow;

		const suggestedName = `user-${clerkUserId.slice(0, 8)}`;

		const { data: created, error: insertError } = await getSupabase()
			.from('users')
			.insert({
				clerk_user_id: clerkUserId,
				username: suggestedName
			})
			.select('id, username')
			.single();

		if (insertError) throw new Error(insertError.message);
		return created as UserRow;
	},

	async getUserProfile(clerkUserId: string) {
		const { data: user, error } = await getSupabase()
			.from('users')
			.select('*')
			.eq('clerk_user_id', clerkUserId)
			.single();

		if (error) throw new Error(error.message);
		return user as UserRow | null;
	},

	async updateProfile(clerkUserId: string, updates: Record<string, unknown>) {
		const allowed = ['username'] as const;
		const safe: Record<string, unknown> = {};

		for (const key of allowed) {
			if (key in updates) {
				safe[key] = updates[key];
			}
		}

		if (Object.keys(safe).length === 0) return null;

		safe.updated_at = new Date().toISOString();

		const { data, error } = await getSupabase()
			.from('users')
			.update(safe)
			.eq('clerk_user_id', clerkUserId)
			.select()
			.single();

		if (error) throw new Error(error.message);
		return data as UserRow;
	}
};
