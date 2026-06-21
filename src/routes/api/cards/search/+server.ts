import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { searchRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { searchCards } from '$lib/api/card-service';

export const GET: RequestHandler = async (event) => {
  const { url } = event;
  const rateCheck = searchRateLimiter(event);
  if (!rateCheck.passed) {
    return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);
  }

  const query = url.searchParams.get('q');
  const game = url.searchParams.get('game') || 'mtg';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '25', 10), 100);

  if (!query || query.length < 2) {
    return json({ success: false, error: { message: 'Query must be at least 2 characters' } }, { status: 400 });
  }

  if (!['mtg', 'pokemon', 'riftbound'].includes(game)) {
    return json({ success: false, error: { message: 'Unsupported game' } }, { status: 400 });
  }

  try {
    const result = await searchCards(game, query, limit);
    return json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed';
    return json({ success: false, error: { message } }, { status: 500 });
  }
};
