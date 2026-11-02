// Reads a recipe out of a web page. Almost every recipe site publishes a schema.org
// Recipe block (JSON-LD) for search engines, so that is what this reads. Pure: the
// server route fetches the page, this turns the HTML into a ParsedRecipe.

import { detectTimer, parseIngredientLine, type ParsedRecipe } from './parseRecipe'

export interface ImportedRecipe extends ParsedRecipe {
  title: string
  description?: string
  imageUrl?: string
  source: string
  sourceUrl: string
}

type Json = unknown
type Obj = Record<string, Json>
const isObj = (v: Json): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  deg: '°',
  ndash: '–',
  mdash: '—',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  hellip: '…',
}

/** Turns "&amp;", "&#39;" and stray tags into plain text. */
export function plainText(s: string): string {
  // Some sites escape twice ("&amp;amp;"), so decode until nothing changes.
  let out = decodeOnce(s)
  for (let i = 0; i < 2 && /&[#a-z0-9]+;/i.test(out); i++) out = decodeOnce(out)
  return out
}

function decodeOnce(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n: string) => safeChar(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => safeChar(parseInt(n, 16)))
    .replace(/&([a-z0-9]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
}

function safeChar(code: number): string {
  try {
    return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ''
  } catch {
    return ''
  }
}

/** ISO 8601 durations: "PT1H15M" -> 75, "P0DT45M" -> 45. */
export function isoMinutes(v: Json): number | undefined {
  if (typeof v !== 'string') return undefined
  const m = v.match(
    /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i
  )
  if (!m) return undefined
  const total =
    Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) + Number(m[4] ?? 0) / 60
  return total > 0 && total < 7 * 1440 ? Math.round(total) : undefined
}

function hasType(o: Obj, type: string): boolean {
  const t = o['@type']
  return Array.isArray(t) ? t.includes(type) : t === type
}

/** Finds the first Recipe object anywhere in a JSON-LD value (@graph, arrays, nesting). */
function findRecipe(v: Json, depth = 0): Obj | undefined {
  if (depth > 6) return undefined
  if (Array.isArray(v)) {
    for (const x of v) {
      const r = findRecipe(x, depth + 1)
      if (r) return r
    }
    return undefined
  }
  if (!isObj(v)) return undefined
  if (hasType(v, 'Recipe')) return v
  for (const k of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) {
    const r = findRecipe(v[k], depth + 1)
    if (r) return r
  }
  return undefined
}

function text(v: Json): string | undefined {
  if (typeof v === 'string') return plainText(v) || undefined
  if (Array.isArray(v)) return text(v[0])
  if (isObj(v)) return text(v.text ?? v.name)
  return undefined
}

function imageOf(v: Json): string | undefined {
  if (typeof v === 'string') return /^https:\/\//i.test(v) ? v : undefined
  if (Array.isArray(v)) {
    for (const x of v) {
      const u = imageOf(x)
      if (u) return u
    }
    return undefined
  }
  if (isObj(v)) return imageOf(v.url ?? v.contentUrl ?? v['@id'])
  return undefined
}

function yieldOf(v: Json): number | undefined {
  const vals = Array.isArray(v) ? v : [v]
  for (const x of vals) {
    const n = typeof x === 'number' ? x : typeof x === 'string' ? Number(x.match(/\d+/)?.[0]) : NaN
    if (n >= 1 && n <= 24) return Math.round(n)
  }
  return undefined
}

/** Steps come as a string, a list of strings, HowToStep objects, or HowToSections of steps. */
function stepsOf(v: Json, out: string[] = [], depth = 0): string[] {
  if (depth > 4 || out.length > 60) return out
  if (typeof v === 'string') {
    const s = plainText(v)
    // One long string: split on numbered steps or line breaks in the source.
    const parts = v.includes('\n')
      ? v.split(/\n+/).map(plainText)
      : s.split(/\s(?=\d+[.)]\s)/).map((p) => p.trim())
    for (const p of parts) {
      const clean = p.replace(/^\d+[.)]\s*/, '').trim()
      if (clean) out.push(clean)
    }
    return out
  }
  if (Array.isArray(v)) {
    for (const x of v) stepsOf(x, out, depth + 1)
    return out
  }
  if (isObj(v)) {
    if (hasType(v, 'HowToSection') || Array.isArray(v.itemListElement))
      return stepsOf(v.itemListElement, out, depth + 1)
    const s = text(v.text) ?? text(v.name)
    if (s) out.push(s)
  }
  return out
}

/** All JSON-LD blocks in a page, parsed. Broken blocks are skipped. */
function jsonLdBlocks(html: string): Json[] {
  const out: Json[] = []
  const re = /<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const raw = m[1].trim().replace(/^<!--|-->$/g, '')
    try {
      out.push(JSON.parse(raw))
    } catch {
      // Some sites leave raw control characters in strings; try once more without them.
      try {
        out.push(JSON.parse(raw.replace(/[\u0000-\u001f]+/g, ' ')))
      } catch {
        /* not readable */
      }
    }
  }
  return out
}

function meta(html: string, prop: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)\\s*=\\s*["']${prop}["'][^>]*content\\s*=\\s*["']([^"']*)["']`,
    'i'
  )
  const re2 = new RegExp(
    `<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*(?:property|name)\\s*=\\s*["']${prop}["']`,
    'i'
  )
  const v = html.match(re)?.[1] ?? html.match(re2)?.[1]
  return v ? plainText(v) : undefined
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * The recipe in a page, or null when the page doesn't publish one. Keeps at most
 * 80 ingredients and 60 steps, so a huge page can't flood the editor.
 */
export function extractRecipe(html: string, url: string): ImportedRecipe | null {
  let recipe: Obj | undefined
  for (const block of jsonLdBlocks(html)) {
    recipe = findRecipe(block)
    if (recipe) break
  }
  if (!recipe) return null

  const title = text(recipe.name) ?? meta(html, 'og:title')
  if (!title) return null

  const ingLines = (Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [])
    .concat(Array.isArray(recipe.ingredients) ? recipe.ingredients : [])
    .map((x) => (typeof x === 'string' ? plainText(x) : ''))
    .filter(Boolean)
    .slice(0, 80)

  const prep = isoMinutes(recipe.prepTime)
  const cook = isoMinutes(recipe.cookTime)
  const total =
    isoMinutes(recipe.totalTime) ?? (prep || cook ? (prep ?? 0) + (cook ?? 0) : undefined)

  const steps = stepsOf(recipe.recipeInstructions)
    .slice(0, 60)
    .map((s) => {
      const tm = detectTimer(s)
      return tm ? { text: s, timerMinutes: tm } : { text: s }
    })

  const description = text(recipe.description) ?? meta(html, 'og:description')
  return {
    title: title.slice(0, 80),
    description: description ? description.slice(0, 280) : undefined,
    imageUrl: imageOf(recipe.image) ?? imageOf(meta(html, 'og:image')),
    servings: yieldOf(recipe.recipeYield),
    // "Prep" sometimes includes a day of brining; hands-on time is never that long.
    activeMinutes:
      prep && prep <= 120 ? prep : total ? Math.min(total, prep ? 30 : total, 30) : undefined,
    totalMinutes: total,
    ingredients: ingLines
      .map((l) => parseIngredientLine(l))
      .filter((x): x is NonNullable<typeof x> => x !== null),
    steps,
    source: hostOf(url),
    sourceUrl: url,
  }
}

/** Pulls the first web link out of shared text ("Look at this https://… yum"). */
export function findUrl(s: string | undefined | null): string | undefined {
  const m = s?.match(/https?:\/\/[^\s<>"']+/i)
  return m ? m[0].replace(/[),.;!?]+$/, '') : undefined
}
