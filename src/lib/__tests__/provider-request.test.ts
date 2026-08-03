import { describe, it, expect, vi } from 'vitest';
import {
	createProviderLimiter,
	ProviderRequestError
} from '../api/providers/request';

function mockResponse(status: number, headers: Record<string, string> = {}): Response {
	return {
		status,
		headers: { get: (name: string) => headers[name.toLowerCase()] ?? null }
	} as unknown as Response;
}

function makeLimiter(overrides: Partial<Parameters<typeof createProviderLimiter>[1]> = {}) {
	let clock = 0;
	const sleepCalls: Array<{ ms: number; resolve: () => void }> = [];
	const sleep = (ms: number) =>
		new Promise<void>((resolve) => sleepCalls.push({ ms, resolve: () => resolve() }));
	const fetchImpl = vi.fn();
	const limiter = createProviderLimiter(
		'test',
		{ minIntervalMs: 10, maxConcurrent: 1, maxRetries: 1, timeoutMs: 1000, ...overrides },
		{ fetchImpl, now: () => clock, sleep }
	);
	return { limiter, fetchImpl, sleepCalls, advance: (ms: number) => (clock += ms) };
}

async function tick() {
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe('createProviderLimiter', () => {
	it('paces requests to a minimum interval', async () => {
		const { limiter, fetchImpl, sleepCalls } = makeLimiter();
		fetchImpl.mockResolvedValue(mockResponse(200));
		await limiter({ url: '/1' });
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		expect(sleepCalls).toHaveLength(0);

		const p2 = limiter({ url: '/2' });
		await tick();
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		expect(sleepCalls).toHaveLength(1);
		expect(sleepCalls[0].ms).toBe(10);
		sleepCalls[0].resolve();
		await p2;
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it('caps concurrent requests', async () => {
		const { limiter, fetchImpl, sleepCalls } = makeLimiter();
		let resolveFirst!: () => void;
		const first = new Promise<Response>((resolve) => {
			resolveFirst = () => resolve(mockResponse(200));
		});
		fetchImpl.mockReturnValueOnce(first).mockResolvedValue(mockResponse(200));

		const p1 = limiter({ url: '/1' });
		await tick();
		expect(fetchImpl).toHaveBeenCalledTimes(1);

		const p2 = limiter({ url: '/2' });
		await tick();
		expect(fetchImpl).toHaveBeenCalledTimes(1);

		resolveFirst();
		await p1;
		await tick();
		expect(sleepCalls).toHaveLength(1);
		sleepCalls[0].resolve();
		await p2;
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it('retries on 429 honoring Retry-After', async () => {
		const { limiter, fetchImpl, sleepCalls } = makeLimiter();
		fetchImpl
			.mockResolvedValueOnce(mockResponse(429, { 'retry-after': '1' }))
			.mockResolvedValueOnce(mockResponse(200));

		const promise = limiter({ url: '/x' });
		await tick();
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		expect(sleepCalls).toHaveLength(1);
		expect(sleepCalls[0].ms).toBe(1000);
		sleepCalls[0].resolve();
		const res = await promise;
		expect(res.status).toBe(200);
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it('throws after retries are exhausted', async () => {
		const { limiter, fetchImpl, sleepCalls } = makeLimiter();
		fetchImpl.mockResolvedValue(mockResponse(429, { 'retry-after': '1' }));

		const promise = limiter({ url: '/x' });
		await tick();
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		expect(sleepCalls).toHaveLength(1);
		sleepCalls[0].resolve();
		await expect(promise).rejects.toBeInstanceOf(ProviderRequestError);
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it('backs off exponentially on 5xx', async () => {
		const { limiter, fetchImpl, sleepCalls } = makeLimiter();
		fetchImpl.mockResolvedValueOnce(mockResponse(503)).mockResolvedValueOnce(mockResponse(200));

		const promise = limiter({ url: '/x' });
		await tick();
		expect(sleepCalls).toHaveLength(1);
		expect(sleepCalls[0].ms).toBe(250);
		sleepCalls[0].resolve();
		const res = await promise;
		expect(res.status).toBe(200);
	});

	it('returns non-retryable statuses as-is', async () => {
		const { limiter, fetchImpl } = makeLimiter();
		fetchImpl.mockResolvedValue(mockResponse(404));
		const res = await limiter({ url: '/missing' });
		expect(res.status).toBe(404);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it('times out slow requests', async () => {
		const { limiter, fetchImpl } = makeLimiter({ timeoutMs: 20 });
		fetchImpl.mockReturnValue(new Promise<Response>(() => {}));

		await expect(limiter({ url: '/slow' })).rejects.toBeInstanceOf(ProviderRequestError);
	});
});
