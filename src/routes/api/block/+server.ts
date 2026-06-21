import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { apiRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { supabase } from '$lib/server/supabase';
import { z } from 'zod/v4';

const BlockSchema = z.object({
  blockedId: z.string().uuid()
});

export const GET: RequestHandler = async ({ locals }) => {
  const auth = await locals.auth();
  const clerkUserId = auth.userId;
  if (!clerkUserId) {
    return json({ success: false, error: { message: 'Authentication required' } }, { status: 401 });
  }

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .single();

  if (!user) {
    return json({ success: false, error: { message: 'User not found' } }, { status: 404 });
  }

  const { data: blocked } = await supabase
    .from('blocked_users')
    .select('blocked_id, blocked:blocked_id(id, display_name, username)')
    .eq('blocker_id', user.id);

  return json({ success: true, data: { blocked: blocked || [] } });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const rateCheck = apiRateLimiter({ request, getClientAddress: () => request.headers.get('x-forwarded-for') || 'unknown' } as any);
  if (!rateCheck.passed) return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);

  const auth = await locals.auth();
  const clerkUserId = auth.userId;
  if (!clerkUserId) {
    return json({ success: false, error: { message: 'Authentication required' } }, { status: 401 });
  }

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .single();

  if (!user) {
    return json({ success: false, error: { message: 'User not found' } }, { status: 404 });
  }

  const body = await request.json();
  const parsed = BlockSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, error: { message: parsed.error.issues.map(i => i.message).join(', ') } }, { status: 400 });
  }

  if (parsed.data.blockedId === user.id) {
    return json({ success: false, error: { message: 'Cannot block yourself' } }, { status: 400 });
  }

  const { error } = await supabase.from('blocked_users').upsert({
    blocker_id: user.id,
    blocked_id: parsed.data.blockedId
  }, { onConflict: 'blocker_id,blocked_id' });

  if (error) {
    return json({ success: false, error: { message: error.message } }, { status: 500 });
  }

  return json({ success: true });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
  const auth = await locals.auth();
  const clerkUserId = auth.userId;
  if (!clerkUserId) {
    return json({ success: false, error: { message: 'Authentication required' } }, { status: 401 });
  }

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .single();

  if (!user) {
    return json({ success: false, error: { message: 'User not found' } }, { status: 404 });
  }

  const body = await request.json();
  const parsed = BlockSchema.safeParse(body);
  if (!parsed.success) {
    return json({ success: false, error: { message: parsed.error.issues.map(i => i.message).join(', ') } }, { status: 400 });
  }

  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', parsed.data.blockedId);

  if (error) {
    return json({ success: false, error: { message: error.message } }, { status: 500 });
  }

  return json({ success: true });
};
