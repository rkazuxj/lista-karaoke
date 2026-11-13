"use strict";

const cacheName = "lista-karaoke-v6";
const home = new URL("./index.html", self.registration.scope).href;
const assets = [
    "./index.html", "./css/style.css", "./js/script.js", "./manifest.webmanifest",
    "./img/logo.png", "./img/microfone.png", "./img/apple-touch-icon.png",
    "./img/icon-192.png", "./img/icon-maskable.png"
];

self.addEventListener("install", (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(cacheName);
        await cache.addAll(assets);
        await self.skipWaiting();
    })());
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names
            .filter((name) => name.startsWith("lista-karaoke-") && name !== cacheName)
            .map((name) => caches.delete(name)));
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== "GET" || !url.href.startsWith(self.registration.scope)) return;

    if (request.mode === "navigate") {
        event.respondWith(fetch(request).catch(async () => {
            const cache = await caches.open(cacheName);
            return (await cache.match(home)) ?? Response.error();
        }));
        return;
    }

    if (assets.some((asset) => new URL(asset, self.registration.scope).href === url.href)) {
        event.respondWith(fetch(request).catch(async () => {
            const cache = await caches.open(cacheName);
            return (await cache.match(request)) ?? Response.error();
        }));
    }
});
