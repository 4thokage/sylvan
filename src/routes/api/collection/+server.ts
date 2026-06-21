import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { apiRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { getCollection, saveCollection, clearCollection } from '$lib/server/services/collection.service';
import { SaveCollectionSchema } from '$lib/schemas/api';

export const GET: RequestHandler = async ({ locals, url }) => {
  const auth = await locals.auth();
  const clerkUserId = auth.userId;
  if (!clerkUserId) {
    return json({ success: false, error: { message: 'Authentication required' } }, { status: 401 });
  }
  const gameSlug = url.searchParams.get('game') || 'mtg';
  const cards = await getCollection(clerkUserId, gameSlug);
  return json({ success: true, data: { cards } });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const rateCheck = apiRateLimiter({ request, getClientAddress: () => request.headers.get('x-forwarded-for') || 'unknown' } as any);
  if (!rateCheck.passed) return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);

  const auth = await locals.auth();
  const clerkUserId = auth.userId;
  if (!clerkUserId) {
    return json({ success: false, error: { message: 'Authentication required' } }, { status: 401 });
  }

  const body = await request.json();
  const parsed = SaveCollectionSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, error: { message: parsed.error.issues.map(i => i.message).join(', ') } }, { status: 400 });
  }

  const result = await saveCollection(clerkUserId, parsed.data.cards, parsed.data.gameSlug);
  return json({ success: true, data: { errors: result.errors } });
};

export const DELETE: RequestHandler = async ({ locals, url }) => {
  const auth = await locals.auth();
  const clerkUserId = auth.userId;
  if (!clerkUserId) {
    return json({ success: false, error: { message: 'Authentication required' } }, { status: 401 });
  }

  const gameSlug = url.searchParams.get('game') || undefined;
  await clearCollection(clerkUserId, gameSlug);
  return json({ success: true });
};
