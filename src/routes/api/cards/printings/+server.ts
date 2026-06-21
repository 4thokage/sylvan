import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { searchRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { getAllPrintings } from '$lib/api/card-service';

export const GET: RequestHandler = async (event) => {
  const { url } = event;
  const rateCheck = searchRateLimiter(event);
  if (!rateCheck.passed) {
    return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);
  }

  const name = url.searchParams.get('name');
  const game = url.searchParams.get('game') || 'mtg';

  if (!name || name.length < 1) {
    return json({ success: false, error: { message: 'Card name is required' } }, { status: 400 });
  }

  if (!['mtg', 'pokemon', 'riftbound'].includes(game)) {
    return json({ success: false, error: { message: 'Unsupported game' } }, { status: 400 });
  }

  try {
    const printings = await getAllPrintings(game, name);
    return json({ success: true, data: { printings } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch printings';
    console.error('[PrintingsAPI] Error:', err);
    return json({ success: false, error: { message } }, { status: 500 });
  }
};
