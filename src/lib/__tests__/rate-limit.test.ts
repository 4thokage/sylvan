import { describe, it, expect, beforeEach } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { createRateLimiter } from '$lib/server/middleware/rate-limit';

function mockRequest(ip = '127.0.0.1'): RequestEvent {
	return {
		request: {
			headers: new Map()
		},
		getClientAddress: () => ip
	} as unknown as RequestEvent;
}

describe('createRateLimiter', () => {
	beforeEach(() => {
		// Reset stores by creating a new limiter
	});

	it('allows requests within limit', () => {
		const limiter = createRateLimiter('test1', { windowMs: 60000, maxRequests: 5 });
		for (let i = 0; i < 5; i++) {
			const result = limiter(mockRequest());
			expect(result.passed).toBe(true);
		}
	});

	it('blocks requests exceeding limit', () => {
		const limiter = createRateLimiter('test2', { windowMs: 60000, maxRequests: 3 });
		for (let i = 0; i < 3; i++) {
			expect(limiter(mockRequest()).passed).toBe(true);
		}
		expect(limiter(mockRequest()).passed).toBe(false);
	});

	it('tracks remaining count', () => {
		const limiter = createRateLimiter('test3', { windowMs: 60000, maxRequests: 5 });
		expect(limiter(mockRequest()).remaining).toBe(4);
		expect(limiter(mockRequest()).remaining).toBe(3);
		expect(limiter(mockRequest()).remaining).toBe(2);
	});

	it('handles different IPs separately', () => {
		const limiter = createRateLimiter('test4', { windowMs: 60000, maxRequests: 2 });
		expect(limiter(mockRequest('1.1.1.1')).passed).toBe(true);
		expect(limiter(mockRequest('1.1.1.1')).passed).toBe(true);
		expect(limiter(mockRequest('1.1.1.1')).passed).toBe(false);
		expect(limiter(mockRequest('2.2.2.2')).passed).toBe(true);
	});

	it('resets after window expires', () => {
		const limiter = createRateLimiter('test5', { windowMs: -1, maxRequests: 1 });
		// windowMs negative means the window has already expired
		const result1 = limiter(mockRequest());
		expect(result1.passed).toBe(true);
		const result2 = limiter(mockRequest());
		// New window should have started
		expect(result2.passed).toBe(true);
	});
});
