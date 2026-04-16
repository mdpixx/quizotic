// Quizotic service worker — minimal, online-only.
// Purpose: satisfy PWA install criteria and show an offline fallback
// for page navigations. Does NOT cache assets, API, or Socket.io traffic.

const OFFLINE_URL = '/offline'

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open('quizotic-offline-v1')
      await cache.add(new Request(OFFLINE_URL, { cache: 'reload' }))
      await self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((k) => k !== 'quizotic-offline-v1').map((k) => caches.delete(k))
      )
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only intercept top-level GET navigations. Everything else
  // (Socket.io, API, static assets) goes straight to the network.
  if (request.method !== 'GET') return
  if (request.mode !== 'navigate') return

  event.respondWith(
    (async () => {
      try {
        return await fetch(request)
      } catch {
        const cache = await caches.open('quizotic-offline-v1')
        const cached = await cache.match(OFFLINE_URL)
        return cached ?? new Response('Offline', { status: 503, statusText: 'Offline' })
      }
    })()
  )
})
