const CACHE = 'sthlm-tri-v1'

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
            caches.open(CACHE).then((c) => c.put(request, res.clone()))
            return res
          })
      )
    )
  }
})
