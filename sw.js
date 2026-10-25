"use strict";

const CACHE_NAME = "saint-amour-bar-pro-v1";

const FICHIERS_A_METTRE_EN_CACHE = [
    "./",
    "./index.html",
    "./manifest.json",
    "./css/style.css"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(FICHIERS_A_METTRE_EN_CACHE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(noms =>
            Promise.all(
                noms
                    .filter(nom => nom !== CACHE_NAME)
                    .map(nom => caches.delete(nom))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") {
        return;
    }

    const url = new URL(event.request.url);

    // Ne jamais intercepter les appels Supabase.
    if (
        url.hostname.includes("supabase.co") ||
        url.origin !== self.location.origin
    ) {
        return;
    }

    // Réseau en priorité, cache si le réseau est indisponible.
    event.respondWith(
        fetch(event.request).catch(() =>
            caches.match(event.request)
        )
    );
});