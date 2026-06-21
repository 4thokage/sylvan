import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { saveRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { replaceCollection, saveCollection } from '$lib/server/services/collection.service';
import { parseCardList, parseCsv, parseDeckbox } from '$lib/parser';

export const POST: RequestHandler = async (event) => {
  const { request, locals } = event;
  const rateCheck = saveRateLimiter(event);
  if (!rateCheck.passed) {
    return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);
  }

  try {
    const auth = await locals.auth();
    const clerkUserId = auth.userId;

    if (!clerkUserId) {
      return json({ success: false, error: { message: 'Authentication required' } }, { status: 401 });
    }

    const body = await request.json();
    const format = body.format || 'text';
    const merge = body.merge !== false;
    const text = body.text || '';
    const gameSlug: string = body.game || 'mtg';

    if (!['mtg', 'pokemon', 'riftbound'].includes(gameSlug)) {
      return json({ success: false, error: { message: 'Unsupported game' } }, { status: 400 });
    }

    let parsedCards: Array<{ name: string; qty: number }>;

    switch (format) {
      case 'csv':
        parsedCards = parseCsv(text).map((c) => ({ name: c.name, qty: c.qty }));
        break;
      case 'deckbox':
        parsedCards = parseDeckbox(text).map((c) => ({ name: c.name, qty: c.qty }));
        break;
      case 'text':
      default:
        parsedCards = parseCardList(text).map((c) => ({
          name: c.name,
          qty: c.qty
        }));
        break;
    }

    if (parsedCards.length === 0) {
      return json({ success: false, error: { message: 'No cards found in input' } }, { status: 400 });
    }
    if (parsedCards.length > 5000) {
      return json({ success: false, error: { message: 'Too many cards (max 5000)' } }, { status: 400 });
    }

    if (merge) {
      const result = await saveCollection(clerkUserId, parsedCards, gameSlug);
      return json({ success: true, data: { count: parsedCards.length, errors: result.errors } });
    } else {
      await replaceCollection(clerkUserId, parsedCards, gameSlug);
      return json({ success: true, data: { count: parsedCards.length } });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed';
    return json({ success: false, error: { message } }, { status: 500 });
  }
};
