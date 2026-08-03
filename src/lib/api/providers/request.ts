export interface ProviderRequestOptions {
	url: string;
	method?: 'GET' | 'POST';
	headers?: Record<string, string>;
	body?: string;
}

export interface ProviderLimiterConfig {
	minIntervalMs: number;
	maxConcurrent: number;
	maxRetries: number;
	timeoutMs: number;
	retryableStatuses?: number[];
}

export interface ProviderLimiterDeps {
	fetchImpl?: (input: string, init: RequestInit) => Promise<Response>;
	now?: () => number;
	sleep?: (ms: number) => Promise<void>;
}

export class ProviderRequestError extends Error {
	constructor(
		public readonly provider: string,
		public readonly status: number | null,
		message: string
	) {
		super(message);
		this.name = 'ProviderRequestError';
	}
}

const DEFAULT_RETRYABLE = [429, 500, 502, 503, 504];

export function createProviderLimiter(
	provider: string,
	config: ProviderLimiterConfig,
	deps: ProviderLimiterDeps = {}
) {
	const { maxRetries, timeoutMs } = config;
	const retryable = config.retryableStatuses ?? DEFAULT_RETRYABLE;
	const fetchImpl = deps.fetchImpl ?? ((input: string, init: RequestInit) => fetch(input, init));
	const now = deps.now ?? Date.now;
	const sleep =
		deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

	let lastStartAt = Number.NEGATIVE_INFINITY;
	let inFlight = 0;
	const waiters: Array<() => void> = [];

	async function acquireSlot(): Promise<() => void> {
		while (inFlight >= config.maxConcurrent) {
			await new Promise<void>((resolve) => waiters.push(resolve));
		}
		inFlight++;
		const wait = Math.max(0, lastStartAt + config.minIntervalMs - now());
		if (wait > 0) await sleep(wait);
		lastStartAt = now();
		return () => {
			inFlight--;
			waiters.shift()?.();
		};
	}

	function backoffMs(attempt: number): number {
		return Math.min(250 * Math.pow(2, attempt - 1), 5000);
	}

	async function request(opts: ProviderRequestOptions): Promise<Response> {
		const release = await acquireSlot();
		let attempt = 0;
		try {
			for (;;) {
				let response: Response;
				let timedOut = false;
				let timer: ReturnType<typeof setTimeout> | undefined;
				const timeoutPromise = new Promise<never>((_, reject) => {
					timer = setTimeout(
						() => reject(new ProviderRequestError(provider, null, `${provider} request timed out`)),
						timeoutMs
					);
				});
				try {
					response = await Promise.race([
						fetchImpl(opts.url, {
							method: opts.method ?? 'GET',
							headers: opts.headers,
							body: opts.body
						}),
						timeoutPromise
					]);
				} catch (err) {
					if (err instanceof ProviderRequestError) throw err;
					timedOut = true;
					response = null as unknown as Response;
				} finally {
					if (timer) clearTimeout(timer);
				}

				attempt++;
				if (!timedOut && !retryable.includes(response.status)) {
					return response;
				}
				if (attempt > maxRetries) {
					throw new ProviderRequestError(
						provider,
						timedOut ? null : response.status,
						timedOut
							? `${provider} request timed out`
							: `${provider} request failed with status ${response.status}`
					);
				}
				let waitMs: number;
				if (!timedOut && response.status === 429) {
					const retryAfter = response.headers.get('retry-after');
					waitMs = retryAfter ? Math.max(Number(retryAfter) * 1000, 250) : backoffMs(attempt);
				} else {
					waitMs = backoffMs(attempt);
				}
				await sleep(waitMs);
			}
		} finally {
			release();
		}
	}

	async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
		const release = await acquireSlot();
		try {
			return await fn();
		} finally {
			release();
		}
	}

	return Object.assign(request, { withSlot });
}

export const providerLimiters = {
	scryfall: createProviderLimiter('scryfall', {
		minIntervalMs: 100,
		maxConcurrent: 4,
		maxRetries: 2,
		timeoutMs: 10_000
	}),
	tcgdex: createProviderLimiter('tcgdex', {
		minIntervalMs: 150,
		maxConcurrent: 4,
		maxRetries: 2,
		timeoutMs: 10_000
	}),
	riftbound: createProviderLimiter('riftbound', {
		minIntervalMs: 250,
		maxConcurrent: 2,
		maxRetries: 2,
		timeoutMs: 10_000
	})
};
