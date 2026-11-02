// "Save to Plantry" from the page you're reading. Some recipe sites refuse to let
// servers read them, but they still publish the recipe for search engines inside the
// page. A bookmark button runs in the cook's own browser, picks up that recipe block
// and the page text, in case that block can't be read, and opens Plantry with it in the link's #hash,
// which never reaches a server.

import { extractRecipe, hostOf, type ImportedRecipe } from './importRecipe'
import { parseRecipe, type ParsedRecipe } from './parseRecipe'

export const CAPTURE_KEY = 'page'

/** What the bookmark sends. Short names keep the link small. */
interface Capture {
  /** Page address. */
  u: string
  /** JSON-LD blocks that mention a Recipe. */
  ld?: string[]
  /** og:image. */
  im?: string
  /** Page text, used when the recipe block can't be read. */
  tx?: string
}

/** The bookmark's code. `origin` is where this Plantry is served from. */
export function bookmarkletCode(origin: string): string {
  const js = String.raw`(()=>{const d={u:location.href};const l=[...document.querySelectorAll('script[type="application/ld+json"]')].map(e=>e.textContent||'').filter(x=>/"@type"\s*:\s*(\[[^\]]*)?"Recipe"/.test(x));if(l.length)d.ld=l;d.tx=(document.querySelector('article,main')||document.body).innerText.slice(0,12000);const m=document.querySelector('meta[property="og:image"]');if(m)d.im=m.content;const w=window.open(${JSON.stringify(origin + '/recipes/new#' + CAPTURE_KEY + '=')}+encodeURIComponent(JSON.stringify(d)),'_blank');if(!w)location.href=${JSON.stringify(origin + '/recipes/new#' + CAPTURE_KEY + '=')}+encodeURIComponent(JSON.stringify(d))})()`
  return `javascript:${js}`
}

const MAX = 600_000

/**
 * Reads a capture from a location hash ("#page=…"). Returns the recipe, or null
 * when the hash isn't a capture or holds nothing usable.
 */
export function readCapture(hash: string): (ParsedRecipe & Partial<ImportedRecipe>) | null {
  const prefix = `#${CAPTURE_KEY}=`
  if (!hash.startsWith(prefix) || hash.length > MAX) return null
  let data: Capture
  try {
    data = JSON.parse(decodeURIComponent(hash.slice(prefix.length))) as Capture
  } catch {
    return null
  }
  if (!data || typeof data.u !== 'string' || !/^https?:\/\//i.test(data.u)) return null
  const url = data.u.slice(0, 2000)
  const blocks = Array.isArray(data.ld) ? data.ld.filter((b) => typeof b === 'string') : []
  if (blocks.length) {
    // Rebuild just enough of a page for the same reader the server uses.
    const safe = (s: string) => s.replace(/<\/script/gi, '<\\/script')
    const image =
      typeof data.im === 'string' && /^https:\/\//i.test(data.im)
        ? `<meta property="og:image" content="${data.im.replace(/["<>]/g, '')}">`
        : ''
    const html =
      image + blocks.map((b) => `<script type="application/ld+json">${safe(b)}</script>`).join('')
    const r = extractRecipe(html, url)
    if (r) return r
  }
  if (typeof data.tx === 'string' && data.tx.trim()) {
    const parsed = parseRecipe(data.tx.slice(0, 15000))
    if (parsed.ingredients.length || parsed.steps.length)
      return { ...parsed, source: hostOf(url), sourceUrl: url }
  }
  return null
}
