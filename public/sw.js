const VERSION = 'pawprint-v2'
const SHELL = ['/', '/setup', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone(); caches.open(VERSION).then((cache) => cache.put(request, copy)); return response
    }).catch(async () => (await caches.match(request)) || (await caches.match('/')) || new Response('<main><h1>Pawprint is offline</h1><p>Your saved memories are still safe. Reconnect and try again.</p></main>', { headers: { 'content-type': 'text/html' } })))
    return
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok && ['style', 'script', 'image', 'font'].includes(request.destination)) caches.open(VERSION).then((cache) => cache.put(request, response.clone()))
    return response
  })))
})
