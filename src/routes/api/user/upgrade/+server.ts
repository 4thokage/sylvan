import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { apiRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { supabase } from '$lib/server/supabase';
import { z } from 'zod/v4';
import { saveAnonymousCollection } from '$lib/server/services/collection.service';

const UpgradeSchema = z.object({
  fingerprint: z.string().min(1).max(256),
  anonymousCards: z.array(z.object({ name: z.string().min(1), qty: z.number().int().min(1) })).max(5000).optional()
});

export const POST: RequestHandler = async ({ request, locals }) => {
  const rateCheck = apiRateLimiter({ request, getClientAddress: () => request.headers.get('x-forwarded-for') || 'unknown' } as any);
  if (!rateCheck.passed) return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);

  const auth = await locals.auth();
  const clerkUserId = auth.userId;
  if (!clerkUserId) {
    return json({ success: false, error: { message: 'Authentication required' } }, { status: 401 });
  }

  const body = await request.json();
  const parsed = UpgradeSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, error: { message: parsed.error.issues.map(i => i.message).join(', ') } }, { status: 400 });
  }

  const { fingerprint, anonymousCards } = parsed.data;

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .single();

  if (!user) {
    return json({ success: false, error: { message: 'User not found' } }, { status: 404 });
  }

  // Step 1: Link session to user
  await supabase
    .from('user_sessions')
    .update({ user_id: user.id, last_seen_at: new Date().toISOString() })
    .eq('fingerprint', fingerprint);

  // Step 2: Merge anonymous collection cards into registered user's collection
  const { data: anonCards } = await supabase
    .from('user_cards')
    .select('card_name, quantity')
    .eq('session_fingerprint', fingerprint)
    .is('user_id', null);

  if (anonCards && anonCards.length > 0) {
    for (const anon of anonCards) {
      const { data: existing } = await supabase
        .from('user_cards')
        .select('id, quantity')
        .eq('user_id', user.id)
        .ilike('card_name', anon.card_name)
        .single();

      if (existing) {
        await supabase
          .from('user_cards')
          .update({ quantity: existing.quantity + anon.quantity, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase.from('user_cards').insert({
          user_id: user.id,
          card_name: anon.card_name,
          quantity: anon.quantity,
          is_public: true
        });
      }
    }

    // Delete migrated anonymous cards
    await supabase
      .from('user_cards')
      .delete()
      .eq('session_fingerprint', fingerprint)
      .is('user_id', null);
  }

  // Step 3: If there are client-side anonymous cards, save those too
  if (anonymousCards && anonymousCards.length > 0) {
    await saveAnonymousCollection(fingerprint, anonymousCards);

    // Merge them too
    for (const incoming of anonymousCards) {
      const { data: existing } = await supabase
        .from('user_cards')
        .select('id, quantity')
        .eq('user_id', user.id)
        .ilike('card_name', incoming.name)
        .single();

      if (existing) {
        await supabase
          .from('user_cards')
          .update({ quantity: existing.quantity + incoming.qty, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase.from('user_cards').insert({
          user_id: user.id,
          card_name: incoming.name,
          quantity: incoming.qty,
          is_public: true
        });
      }
    }

    // Clean up again
    await supabase
      .from('user_cards')
      .delete()
      .eq('session_fingerprint', fingerprint)
      .is('user_id', null);
  }

  return json({ success: true, data: { merged: true } });
};
