import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';

export const PATCH: RequestHandler = async ({ params, locals }) => {
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
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('recipient_id', user.id);

  if (error) {
    return json({ success: false, error: { message: error.message } }, { status: 500 });
  }

  return json({ success: true });
};
