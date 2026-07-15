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

const ANON_ADJECTIVES = [
	'Mysterious',
	'Silent',
	'Curious',
	'Lucky',
	'Hidden',
	'Brave',
	'Ancient',
	'Electric',
	'Crimson',
	'Golden',
	'Shadow',
	'Cosmic',
	'Wandering',
	'Clever',
	'Restless'
];

const ANON_NOUNS = [
	'Mox',
	'Lotus',
	'Dragon',
	'Goblin',
	'Sphinx',
	'Phoenix',
	'Golem',
	'Kraken',
	'Wisp',
	'Griffin',
	'Basilisk',
	'Chimera',
	'Elemental',
	'Hydra',
	'Wraith'
];

export function generateAnonymousName(): string {
	const fp = getCreatorFingerprint();
	let hash = 0;
	for (let i = 0; i < fp.length; i++) {
		hash = (hash << 5) - hash + fp.charCodeAt(i);
		hash = hash & hash;
	}
	const adj = ANON_ADJECTIVES[Math.abs(hash) % ANON_ADJECTIVES.length];
	const noun = ANON_NOUNS[Math.abs((hash >> 5) | 0) % ANON_NOUNS.length];
	return `${adj} ${noun}`;
}
