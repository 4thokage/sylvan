import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getPublicProfile } from '$lib/server/services/user.service';

export const GET: RequestHandler = async ({ params }) => {
  try {
    const profile = await getPublicProfile(params.userId);
    if (!profile) {
      return json({ success: false, error: { message: 'User not found or profile is private' } }, { status: 404 });
    }

    return json({ success: true, data: { profile } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load profile';
    return json({ success: false, error: { message } }, { status: 500 });
  }
};
