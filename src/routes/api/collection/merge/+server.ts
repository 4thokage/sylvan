import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { saveRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { saveCollection } from '$lib/server/services/collection.service';

export const POST: RequestHandler = async ({ request, locals }) => {
  const rateCheck = saveRateLimiter({ request, getClientAddress: () => request.headers.get('x-forwarded-for') || 'unknown' } as any);
  if (!rateCheck.passed) return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);

  const auth = await locals.auth();
  const clerkUserId = auth.userId;
  if (!clerkUserId) {
    return json({ success: false, error: { message: 'Authentication required' } }, { status: 401 });
  }

  const body = await request.json();
  const cards: Array<{ name: string; qty: number }> = body.cards || [];

  if (cards.length === 0) {
    return json({ success: false, error: { message: 'No cards provided' } }, { status: 400 });
  }
  if (cards.length > 5000) {
    return json({ success: false, error: { message: 'Too many cards (max 5000)' } }, { status: 400 });
  }

  const result = await saveCollection(clerkUserId, cards);
  return json({ success: true, data: { count: cards.length, errors: result.errors } });
};
