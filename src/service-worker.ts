/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener('install', () => {
	sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(sw.clients.claim());
});

// Chrome's PWA install criteria require a registered fetch handler. We
// intentionally don't call respondWith — every request falls through to the
// network. Caching would buy nothing: every chat round-trips to a streaming
// LLM endpoint, and stale UI bundles are worse than a cold load.
sw.addEventListener('fetch', () => {});
