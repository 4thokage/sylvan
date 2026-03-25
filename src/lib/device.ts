function getDeviceId(): string {
	const KEY = 'sylvan-device-id';

	if (typeof window === 'undefined') return '';

	let deviceId = localStorage.getItem(KEY);

	if (!deviceId) {
		const fingerprint = [
			navigator.userAgent,
			navigator.language,
			screen.width,
			screen.height,
			screen.colorDepth,
			new Date().getTimezoneOffset()
		].join('|');

		let hash = 0;
		for (let i = 0; i < fingerprint.length; i++) {
			const char = fingerprint.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash;
		}

		deviceId = Math.abs(hash).toString(36) + Date.now().toString(36);
		localStorage.setItem(KEY, deviceId);
	}

	return deviceId;
}

export function getCreatorFingerprint(): string {
	return getDeviceId();
}
