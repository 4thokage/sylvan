import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { apiRateLimiter, rateLimitResponse } from '$lib/server/middleware/rate-limit';
import { getUserProfile, updateProfile } from '$lib/server/services/user.service';

export const GET: RequestHandler = async (event) => {
  const { request, locals } = event;
  const rateCheck = apiRateLimiter(event);
  if (!rateCheck.passed) {
    return rateLimitResponse(rateCheck.remaining, rateCheck.resetAt);
  }

  try {
    const auth = await locals.auth();
    const clerkUserId = auth.userId;

    if (!clerkUserId) {
      return json({ success: false, error: { message: 'Authentication required' } }, { status: 401 });
    }

    const profile = await getUserProfile(clerkUserId);
    if (!profile) {
      return json({ success: false, error: { message: 'Profile not found' } }, { status: 404 });
    }

    return json({ success: true, data: { profile } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load profile';
    return json({ success: false, error: { message } }, { status: 500 });
  }
};

export const PATCH: RequestHandler = async (event) => {
  const { request, locals } = event;
  const rateCheck = apiRateLimiter(event);
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
    const allowed = ['display_name', 'bio', 'location', 'shipping_prefs', 'is_public', 'avatar_url'] as const;
    const updates: Record<string, unknown> = {};

    for (const key of allowed) {
      if (body[key] !== undefined) {
        if (key === 'display_name' && typeof body[key] === 'string' && body[key].length > 128) {
          return json({ success: false, error: { message: 'Display name too long' } }, { status: 400 });
        }
        if (key === 'bio' && typeof body[key] === 'string' && body[key].length > 1000) {
          return json({ success: false, error: { message: 'Bio too long' } }, { status: 400 });
        }
        updates[key] = body[key];
      }
    }

    const updated = await updateProfile(clerkUserId, updates);
    return json({ success: true, data: { profile: updated } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update profile';
    return json({ success: false, error: { message } }, { status: 500 });
  }
};
