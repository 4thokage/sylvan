import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

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
