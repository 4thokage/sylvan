/// <reference lib="webworker" />

export {};

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = 'sylvan-web-v1';
const STATIC_ASSETS = [
	'/',
	'/manifest.json',
	'/icons/icon-72x72.svg',
	'/icons/icon-96x96.svg',
	'/icons/icon-128x128.svg',
	'/icons/icon-144x144.svg',
	'/icons/icon-152x152.svg',
	'/icons/icon-192x192.svg',
	'/icons/icon-384x384.svg',
	'/icons/icon-512x512.svg'
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(STATIC_ASSETS);
		})
	);
	(self as unknown as { skipWaiting: () => void }).skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) => {
			return Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
		})
	);
	(self as unknown as { clients: { claim: () => void } }).clients.claim();
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	if (url.origin === location.origin) {
		event.respondWith(
			caches.match(event.request).then((cached) => {
				if (cached) return cached;

				return fetch(event.request).then((response) => {
					if (response.ok && response.status === 200) {
						const clone = response.clone();
						caches.open(CACHE_NAME).then((cache) => {
							cache.put(event.request, clone);
						});
					}
					return response;
				});
			})
		);
	}
});
