import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export async function requireAuth(event: RequestEvent): Promise<string> {
	const auth = await event.locals.auth();
	const clerkUserId = auth.userId;
	if (!clerkUserId) {
		throw error(401, { success: false, error: { message: 'Authentication required' } });
	}
	return clerkUserId;
}

export async function getOptionalAuth(event: RequestEvent): Promise<string | null> {
	const auth = await event.locals.auth();
	return auth.userId || null;
}
