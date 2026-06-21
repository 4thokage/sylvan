import type { UserRepository } from '$lib/server/repositories/types';
import { userRepository as defaultRepo } from '$lib/server/repositories/user.repository';

export async function ensureUser(clerkUserId: string, repo?: UserRepository) {
	const r = repo || defaultRepo;
	return r.ensureUser(clerkUserId);
}

export async function getUserProfile(clerkUserId: string, repo?: UserRepository) {
	const r = repo || defaultRepo;
	return r.getUserProfile(clerkUserId);
}

export async function getPublicProfile(userId: string, repo?: UserRepository) {
	const r = repo || defaultRepo;
	return r.getPublicProfile(userId);
}

export async function updateProfile(
	clerkUserId: string,
	updates: Record<string, unknown>,
	repo?: UserRepository
) {
	const r = repo || defaultRepo;
	return r.updateProfile(clerkUserId, updates);
}
