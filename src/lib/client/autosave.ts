export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface AutosaveState {
	status: AutosaveStatus;
	error: string | null;
}

export interface AutosaveOptions {
	debounceMs?: number;
	persist: (snapshot: unknown) => Promise<void>;
	onState?: (state: AutosaveState) => void;
	flushOnPagehide?: boolean;
	flushTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'> | null;
}

export interface AutosaveHandle {
	markDirty(snapshot: unknown): void;
	flushNow(): Promise<void>;
	cancelPending(): void;
	dispose(): void;
}

export function createAutosave(options: AutosaveOptions): AutosaveHandle {
	const {
		debounceMs = 2000,
		persist,
		onState,
		flushOnPagehide = true,
		flushTarget = typeof window !== 'undefined' ? window : null
	} = options;

	let latestSnapshot: unknown = null;
	let dirty = false;
	let saving = false;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let disposed = false;

	const state: AutosaveState = { status: 'idle', error: null };

	function emit(next: Partial<AutosaveState>) {
		state.status = next.status ?? state.status;
		state.error = next.error !== undefined ? next.error : state.error;
		onState?.({ status: state.status, error: state.error });
	}

	function clearTimer() {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
	}

	function schedule() {
		if (disposed) return;
		clearTimer();
		timer = setTimeout(() => {
			timer = null;
			void runSave();
		}, debounceMs);
	}

	async function runSave(): Promise<void> {
		if (disposed || saving || !dirty || latestSnapshot === null) return;
		saving = true;
		emit({ status: 'saving', error: null });
		const snapshot = latestSnapshot;
		let ok = false;
		try {
			await persist(snapshot);
			ok = true;
		} catch (err) {
			emit({
				status: 'error',
				error: err instanceof Error ? err.message : 'Autosave failed'
			});
		} finally {
			saving = false;
		}
		if (!ok) return;
		if (latestSnapshot !== snapshot) {
			schedule();
		} else {
			dirty = false;
			emit({ status: 'saved', error: null });
		}
	}

	function onPagehide() {
		if (dirty && latestSnapshot !== null) {
			dirty = false;
			void persist(latestSnapshot).catch(() => {});
		}
	}

	function markDirty(snapshot: unknown) {
		if (disposed) return;
		latestSnapshot = snapshot;
		dirty = true;
		emit({ status: 'idle', error: null });
		schedule();
	}

	async function flushNow(): Promise<void> {
		if (disposed) return;
		clearTimer();
		if (!dirty || latestSnapshot === null) return;
		await runSave();
	}

	function cancelPending() {
		if (disposed) return;
		clearTimer();
		dirty = false;
		latestSnapshot = null;
	}

	function dispose() {
		if (disposed) return;
		disposed = true;
		clearTimer();
		if (flushOnPagehide && flushTarget) {
			flushTarget.removeEventListener('pagehide', onPagehide);
		}
		if (dirty && latestSnapshot !== null) {
			dirty = false;
			void persist(latestSnapshot).catch(() => {});
		}
	}

	if (flushOnPagehide && flushTarget) {
		flushTarget.addEventListener('pagehide', onPagehide);
	}

	return { markDirty, flushNow, cancelPending, dispose };
}
