const CACHE = 'sthlm-tri-v3'

// Static assets to pre-cache on install
// /login utelämnas medvetet — hämtas alltid från nätverket
// för att säkerhetsfixar i auth-flödet alltid ska gälla direkt.
const PRECACHE = [
  '/',
  '/welcome',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Push-notiser ─────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try { payload = event.data.json() } catch { payload = { title: 'STHLM Triathlon', body: event.data.text() } }

  const title   = payload.title ?? 'STHLM Triathlon 2026'
  const options = {
    body:    payload.body ?? '',
    icon:    '/icon-192.png',
    badge:   '/icon-192.png',
    tag:     payload.tag ?? 'sthlm-tri',
    data:    { url: payload.url ?? '/welcome' },
    vibrate: [200, 100, 200],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/welcome'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      return clients.openWindow(url)
    })
  )
})

// ── Fetch-hanterare ───────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== location.origin) return

  // Skip API / Supabase calls — always network
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) return

  // Network-first for navigation (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(request, clone))
          return res
        })
        .catch(() => caches.match(request).then((r) => r ?? caches.match('/')))
    )
    return
  }

  // Cache-first for static assets (_next/static, icons, manifest)
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icon') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/apple-touch-icon.png'
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((res) => {
            if (res.ok) {
              const toCache = res.clone()
              caches.open(CACHE).then((c) => c.put(request, toCache))
            }
            return res
          })
      )
    )
  }
})
