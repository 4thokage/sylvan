import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { apiRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { supabase } from '$lib/server/supabase';
import { createTradeProposal, getTradesForUser } from '$lib/server/services/trade.service';
import { listPublicWishlists } from '$lib/server/services/wishlist.service';
import { TradeProposalSchema } from '$lib/schemas/api';

export const GET: RequestHandler = async (event) => {
  const { locals } = event;
  const rateCheck = apiRateLimiter(event);
  if (!rateCheck.passed) {
    return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);
  }

  try {
    const auth = await locals.auth();
    const clerkUserId = auth.userId;

    if (!clerkUserId) {
      const wishlists = await listPublicWishlists(50, 0);
      return json({ success: true, data: { wishlists } });
    }

    const trades = await getTradesForUser(clerkUserId);

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single();

    return json({ success: true, data: { trades, userId: user?.id } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load trades';
    return json({ success: false, error: { message } }, { status: 500 });
  }
};

export const POST: RequestHandler = async (event) => {
  const { request, locals } = event;
  const rateCheck = apiRateLimiter(event);
  if (!rateCheck.passed) return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);

  try {
    const auth = await locals.auth();
    const clerkUserId = auth.userId;

    if (!clerkUserId) {
      return json({ success: false, error: { message: 'Authentication required' } }, { status: 401 });
    }

    const body = await request.json();
    const parsed = TradeProposalSchema.safeParse(body);
    if (!parsed.success) {
      return json({ success: false, error: { message: parsed.error.issues.map(i => i.message).join(', ') } }, { status: 400 });
    }

    const trade = await createTradeProposal(
      clerkUserId,
      parsed.data.recipientId,
      parsed.data.offeredCardIds,
      parsed.data.requestedCardIds,
      parsed.data.note
    );

    return json({ success: true, data: { trade } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create trade';
    return json({ success: false, error: { message } }, { status: 500 });
  }
};
