import { describe, it, expect, vi } from 'vitest';
import { createAutosave } from '../client/autosave';

function flush(ms = 0) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

class MockEmitter {
	listeners = new Map<string, () => void>();
	addEventListener(type: string, fn: EventListenerOrEventListenerObject) {
		this.listeners.set(type, fn as () => void);
	}
	removeEventListener(type: string, _fn: EventListenerOrEventListenerObject) {
		this.listeners.delete(type);
	}
	emit(type: string) {
		this.listeners.get(type)?.();
	}
}

describe('createAutosave', () => {
	it('persists a snapshot after the debounce window', async () => {
		const persist = vi.fn().mockResolvedValue(undefined);
		const autosave = createAutosave({ debounceMs: 20, persist, flushTarget: null });
		autosave.markDirty([{ name: 'A' }]);
		expect(persist).not.toHaveBeenCalled();
		await flush(40);
		expect(persist).toHaveBeenCalledWith([{ name: 'A' }]);
		autosave.dispose();
	});

	it('coalesces rapid edits into a single save with the latest snapshot', async () => {
		const persist = vi.fn().mockResolvedValue(undefined);
		const autosave = createAutosave({ debounceMs: 20, persist, flushTarget: null });
		autosave.markDirty([{ name: 'A' }]);
		autosave.markDirty([{ name: 'A' }, { name: 'B' }]);
		autosave.markDirty([{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
		await flush(40);
		expect(persist).toHaveBeenCalledTimes(1);
		expect(persist).toHaveBeenCalledWith([{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
		autosave.dispose();
	});

	it('serializes saves and sends a follow-up when edits arrive mid-save', async () => {
		let resolveSave!: () => void;
		const persist = vi.fn().mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					resolveSave = () => resolve();
				})
		);
		const autosave = createAutosave({ debounceMs: 20, persist, flushTarget: null });
		autosave.markDirty([{ name: 'A' }]);
		await flush(40);
		expect(persist).toHaveBeenCalledTimes(1);

		autosave.markDirty([{ name: 'A' }, { name: 'B' }]);
		resolveSave();
		await flush(40);
		expect(persist).toHaveBeenCalledTimes(2);
		expect(persist).toHaveBeenLastCalledWith([{ name: 'A' }, { name: 'B' }]);
		autosave.dispose();
	});

	it('reports errors and retries on the next edit', async () => {
		const persist = vi
			.fn()
			.mockRejectedValueOnce(new Error('boom'))
			.mockResolvedValue(undefined);
		const states: string[] = [];
		const autosave = createAutosave({
			debounceMs: 20,
			persist,
			flushTarget: null,
			onState: (s) => states.push(s.status)
		});
		autosave.markDirty([{ name: 'A' }]);
		await flush(40);
		expect(states).toContain('error');
		autosave.markDirty([{ name: 'A' }, { name: 'B' }]);
		await flush(40);
		expect(persist).toHaveBeenCalledTimes(2);
		expect(states).toContain('saved');
		autosave.dispose();
	});

	it('flushNow persists immediately', async () => {
		const persist = vi.fn().mockResolvedValue(undefined);
		const autosave = createAutosave({ debounceMs: 1000, persist, flushTarget: null });
		autosave.markDirty([{ name: 'A' }]);
		await autosave.flushNow();
		expect(persist).toHaveBeenCalledTimes(1);
		expect(persist).toHaveBeenCalledWith([{ name: 'A' }]);
		autosave.dispose();
	});

	it('cancelPending drops a pending save', async () => {
		const persist = vi.fn().mockResolvedValue(undefined);
		const autosave = createAutosave({ debounceMs: 20, persist, flushTarget: null });
		autosave.markDirty([{ name: 'A' }]);
		autosave.cancelPending();
		await flush(40);
		expect(persist).not.toHaveBeenCalled();
		autosave.dispose();
	});

	it('dispose flushes a dirty snapshot', async () => {
		const persist = vi.fn().mockResolvedValue(undefined);
		const autosave = createAutosave({ debounceMs: 1000, persist, flushTarget: null });
		autosave.markDirty([{ name: 'A' }]);
		autosave.dispose();
		expect(persist).toHaveBeenCalledWith([{ name: 'A' }]);
	});

	it('flushes a dirty snapshot on pagehide', async () => {
		const emitter = new MockEmitter();
		const persist = vi.fn().mockResolvedValue(undefined);
		const autosave = createAutosave({ debounceMs: 1000, persist, flushTarget: emitter });
		autosave.markDirty([{ name: 'A' }]);
		emitter.emit('pagehide');
		await flush(10);
		expect(persist).toHaveBeenCalledWith([{ name: 'A' }]);
		autosave.dispose();
	});
});
