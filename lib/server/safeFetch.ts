// Fetches a public web page for recipe import without letting the server be pointed
// at itself or its private network: only http(s) on standard ports, every hop's
// address is checked, redirects are followed by hand, and size and time are capped.

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export const MAX_PAGE_BYTES = 3_000_000
const TIMEOUT_MS = 8000
const MAX_HOPS = 4

export class FetchRefused extends Error {}

/** True for loopback, private, link-local, carrier NAT and other non-public ranges. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    )
  }
  const v6 = ip.toLowerCase()
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7))
  return (
    v6 === '::' ||
    v6 === '::1' ||
    v6.startsWith('fc') ||
    v6.startsWith('fd') ||
    v6.startsWith('fe8') ||
    v6.startsWith('fe9') ||
    v6.startsWith('fea') ||
    v6.startsWith('feb') ||
    v6.startsWith('ff')
  )
}

async function checkUrl(raw: string): Promise<URL> {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new FetchRefused('bad-url')
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new FetchRefused('bad-url')
  if (u.username || u.password) throw new FetchRefused('bad-url')
  if (u.port && u.port !== '80' && u.port !== '443') throw new FetchRefused('bad-url')
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host))
    throw new FetchRefused('private')
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => [])
  if (addrs.length === 0) throw new FetchRefused('not-found')
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new FetchRefused('private')
  return u
}

/** The page's HTML, or throws FetchRefused / a network error. */
export async function fetchPublicPage(raw: string): Promise<{ html: string; url: string }> {
  let url = raw
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    for (let hop = 0; hop < MAX_HOPS; hop++) {
      const u = await checkUrl(url)
      const res = await fetch(u, {
        redirect: 'manual',
        signal: ctrl.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; PlantryRecipeImport/1.0; +https://plantry.astrolabworks.com)',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en,es;q=0.8',
        },
      })
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location')
        if (!loc) throw new FetchRefused('unreachable')
        url = new URL(loc, u).toString()
        continue
      }
      if (!res.ok) throw new FetchRefused(res.status === 404 ? 'not-found' : 'unreachable')
      const type = res.headers.get('content-type') ?? ''
      if (type && !/html|xml/i.test(type)) throw new FetchRefused('not-a-page')
      const len = Number(res.headers.get('content-length') ?? 0)
      if (len > MAX_PAGE_BYTES) throw new FetchRefused('too-large')
      const reader = res.body?.getReader()
      if (!reader) throw new FetchRefused('unreachable')
      const chunks: Uint8Array[] = []
      let size = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > MAX_PAGE_BYTES) {
          await reader.cancel()
          break
        }
        chunks.push(value)
      }
      const buf = new Uint8Array(size > MAX_PAGE_BYTES ? MAX_PAGE_BYTES : size)
      let at = 0
      for (const c of chunks) {
        buf.set(c.subarray(0, Math.min(c.byteLength, buf.byteLength - at)), at)
        at += c.byteLength
        if (at >= buf.byteLength) break
      }
      return { html: new TextDecoder('utf-8').decode(buf), url: u.toString() }
    }
    throw new FetchRefused('unreachable')
  } finally {
    clearTimeout(timer)
  }
}
