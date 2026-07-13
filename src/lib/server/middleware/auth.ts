import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { ensureUser } from '$lib/server/services/user.service';

export async function requireAuth(event: RequestEvent): Promise<string | Response> {
	const auth = await event.locals.auth();
	const clerkUserId = auth.userId;
	if (!clerkUserId) {
		return json({ success: false, error: { message: 'Authentication required' } }, { status: 401 });
	}
	return clerkUserId;
}

export async function getOptionalAuth(event: RequestEvent): Promise<string | null> {
	const auth = await event.locals.auth();
	return auth.userId || null;
}

export interface AuthedUser {
	clerkUserId: string;
	dbUserId: string;
}

// Ensures the Clerk identity has a corresponding `users` row (idempotent) and
// returns both identifiers. This removes the fragile dependency on the page-load
// `ensure_user` side effect so API endpoints never fail with "User not found".
export async function requireUser(event: RequestEvent): Promise<AuthedUser | Response> {
	const clerkUserId = await requireAuth(event);
	if (typeof clerkUserId !== 'string') return clerkUserId;

	const dbUser = await ensureUser(clerkUserId);
	if (!dbUser?.id) {
		return json({ success: false, error: { message: 'User not found' } }, { status: 401 });
	}

	return { clerkUserId, dbUserId: dbUser.id };
}
