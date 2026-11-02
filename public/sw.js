/* Plantry service worker: makes the app open and work with no signal.
   Pages: network first, cached copy when offline. Build assets: cache first (their names change every build).
   Never touches /api/* so household sync always talks to the server. */
const VERSION = 'v1'
const PAGES = `plantry-pages-${VERSION}`
const ASSETS = `plantry-assets-${VERSION}`
const CORE = [
  '/',
  '/week',
  '/recipes',
  '/pantry',
  '/shop',
  '/household',
  '/settings',
  '/onboarding',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => ![PAGES, ASSETS].includes(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

async function networkFirst(request) {
  const cache = await caches.open(PAGES)
  try {
    const res = await fetch(request)
    if (res.ok && res.type === 'basic') cache.put(request, res.clone())
    return res
  } catch {
    const hit = (await cache.match(request, { ignoreSearch: true })) || (await cache.match('/'))
    return (
      hit ||
      new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } })
    )
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS)
  const hit = await cache.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok && (res.type === 'basic' || res.type === 'cors' || res.type === 'opaque'))
    cache.put(request, res.clone())
  return res
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSETS)
  const hit = await cache.match(request)
  const fresh = fetch(request)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(request, res.clone())
      return res
    })
    .catch(() => hit)
  return hit || fresh
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api/')) return
    if (url.pathname.startsWith('/_next/static/')) return event.respondWith(cacheFirst(request))
    // Only full page loads are cached. Offline in-app links fail over to a full load, which lands here.
    if (request.mode === 'navigate') return event.respondWith(networkFirst(request))
    if (/\.(png|svg|jpg|jpeg|webp|ico|woff2?)$/.test(url.pathname))
      return event.respondWith(staleWhileRevalidate(request))
    return
  }

  // Recipe photos and fonts from other hosts: keep a copy for offline.
  if (url.hostname === 'images.unsplash.com' || url.hostname.endsWith('gstatic.com'))
    return event.respondWith(staleWhileRevalidate(request))
})
