import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { SaveWishlistSchema } from '$lib/schemas/api';
import { saveRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { createWishlist } from '$lib/server/services/wishlist.service';

export const POST: RequestHandler = async (event) => {
  const { request, locals } = event;
  const rateCheck = saveRateLimiter(event);
  if (!rateCheck.passed) {
    return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);
  }

  try {
    const auth = await locals.auth();
    const clerkUserId = auth.userId;

    const body = await request.json();
    const parsed = SaveWishlistSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        { success: false, error: { message: 'Invalid input', details: parsed.error.issues } },
        { status: 400 }
      );
    }

    const { cards, creatorFingerprint, ownerName, gameSlug } = parsed.data;

    const id = await createWishlist({
      cards: cards.map((c: { name: string; qty: number }) => ({ name: c.name, qty: c.qty })),
      creatorFingerprint: creatorFingerprint || undefined,
      ownerName: ownerName || null,
      clerkUserId: clerkUserId || undefined,
      gameSlug: gameSlug || undefined
    });

    return json({ success: true, data: { id } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save wishlist';
    return json({ success: false, error: { message } }, { status: 400 });
  }
};
