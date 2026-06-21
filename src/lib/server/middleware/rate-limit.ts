import type { RequestEvent } from '@sveltejs/kit';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

export function createRateLimiter(name: string, config: RateLimitConfig) {
  const store = new Map<string, RateLimitEntry>();
  stores.set(name, store);

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  }, 60000);

  if (cleanup.unref) {
    cleanup.unref();
  }

  return function rateLimit(event: RequestEvent): { passed: boolean; remaining: number; resetAt: number } {
    const ip = event.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || event.getClientAddress()
      || 'unknown';
    const key = ip;

    const now = Date.now();
    const entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + config.windowMs });
      return { passed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
    }

    entry.count++;
    if (entry.count > config.maxRequests) {
      return { passed: false, remaining: 0, resetAt: entry.resetAt };
    }

    return { passed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
  };
}

export const apiRateLimiter = createRateLimiter('api', { windowMs: 60_000, maxRequests: 60 });
export const saveRateLimiter = createRateLimiter('save', { windowMs: 60_000, maxRequests: 10 });
export const searchRateLimiter = createRateLimiter('search', { windowMs: 60_000, maxRequests: 30 });
export const authRateLimiter = createRateLimiter('auth', { windowMs: 60_000, maxRequests: 20 });

export function rateLimitResponse(remaining: number, resetAt: number) {
  return new Response(
    JSON.stringify({ success: false, error: { message: 'Too many requests. Please try again later.' } }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
        'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000))
      }
    }
  );
}
