import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';

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

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  const unreadCount = (notifications || []).filter(n => !n.read_at).length;

  return json({ success: true, data: { notifications: notifications || [], unreadCount } });
};

export const PATCH: RequestHandler = async ({ locals }) => {
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

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);

  if (error) {
    return json({ success: false, error: { message: error.message } }, { status: 500 });
  }

  return json({ success: true });
};
