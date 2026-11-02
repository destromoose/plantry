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

const OFFLINE_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · Plantry</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#FAF4EA;color:#2A1F1A;font:17px/1.5 system-ui,sans-serif;text-align:center;padding:24px">
<div><h1 style="font-size:24px;margin:0 0 8px">You're offline</h1><p style="margin:0 0 20px">This page wasn't saved on this phone yet. It will be next time you're online.</p>
<a href="/" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#AE4A29;color:#FFFAF4;text-decoration:none;font-weight:600">Back to Tonight</a></div></body></html>`

async function networkFirst(request) {
  const cache = await caches.open(PAGES)
  try {
    const res = await fetch(request)
    if (res.ok && res.type === 'basic') cache.put(request, res.clone())
    return res
  } catch {
    // Exact URL first, then the same page with any query (e.g. a cook page warmed without ?date).
    const hit = (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true }))
    // Never stand in a different page: its HTML would hydrate as the wrong screen.
    return (
      hit || new Response(OFFLINE_PAGE, { status: 503, headers: { 'Content-Type': 'text/html' } })
    )
  }
}

/** Saves pages the app expects to need offline (recipe and cook pages). Skips ones already saved. */
async function warm(urls) {
  const cache = await caches.open(PAGES)
  for (const u of urls) {
    try {
      const url = new URL(u, self.location.origin)
      if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) continue
      if (await cache.match(url.href)) continue
      const res = await fetch(url.href, { credentials: 'same-origin' })
      if (!res.ok || res.type !== 'basic') continue
      // Save the page only once all its files are saved, so a half-saved page is retried next time.
      await warmAssets(await res.clone().text())
      await cache.put(url.href, res)
    } catch {
      return // offline or failing: try again on the next app open
    }
  }
}

/** A page never opened online needs its own script and style files too, or it crashes offline. */
async function warmAssets(html) {
  const cache = await caches.open(ASSETS)
  const paths = new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [])
  for (const path of paths) {
    if (await cache.match(path)) continue
    const res = await fetch(path)
    if (!res.ok) throw new Error(`Could not save ${path}`)
    await cache.put(path, res)
  }
}

self.addEventListener('message', (event) => {
  const data = event.data
  if (data && data.type === 'warm' && Array.isArray(data.urls))
    event.waitUntil(warm(data.urls.slice(0, 400)))
})

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
