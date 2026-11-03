// Turns what someone says or types into shopping list items:
// "we're out of eggs and milk, and get two onions" -> eggs, milk (gone from the pantry), 2 onions.
// No network and no model, so it works offline and in either language.

import { parseIngredientLine } from './parseRecipe'

export interface CapturedItem {
  name: string
  quantity?: number
  unit?: string
  /** Said as "out of" or "used up": it should also leave the pantry. */
  outOf: boolean
}

const numberWords: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  dozen: 12,
  'a dozen': 12,
  'half a dozen': 6,
  couple: 2,
  'a couple': 2,
  'a couple of': 2,
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  docena: 12,
  'una docena': 12,
  'una docena de': 12,
}

// Phrases that start a run of things you've run out of.
const outLeads = [
  "we're out of",
  'we are out of',
  "we've run out of",
  'we ran out of',
  'ran out of',
  'run out of',
  'out of',
  'used up',
  'used up the',
  'finished the',
  'no more',
  'se acabó el',
  'se acabó la',
  'se acabaron los',
  'se acabaron las',
  'se acabó',
  'se acabaron',
  'no queda',
  'no quedan',
  'no hay',
  'nos quedamos sin',
]

// Phrases that start a run of things to buy.
const needLeads = [
  'we need',
  'we also need',
  'i need',
  'need to get',
  'need to buy',
  'need',
  'get some',
  'get',
  'buy',
  'grab',
  'pick up',
  'add',
  'put',
  'also',
  'plus',
  'necesitamos',
  'necesito',
  'nos falta',
  'nos faltan',
  'falta',
  'faltan',
  'comprar',
  'compra',
  'añade',
  'agrega',
  'pon',
  'también',
]

// Words that are just padding before the thing itself.
const fillers = [
  'please',
  'can you',
  'could you',
  'and',
  'y',
  'some',
  'a few',
  'a bit of',
  'a little',
  'a',
  'an',
  'the',
  'more',
  'of',
  'unos',
  'unas',
  'algo de',
  'un poco de',
  'más',
  'el',
  'la',
  'los',
  'las',
  'de',
  'por favor',
]

// Things whose names contain "and", so they are not split in two.
const keepTogether = [
  'mac and cheese',
  'macaroni and cheese',
  'salt and pepper',
  'half and half',
  'sweet and sour',
  'fish and chips',
  'salt and vinegar',
  'pan y queso',
]

// Filler at the end of a sentence, like "and that's it".
const endings =
  /\b(?:that'?s (?:it|all)|and that'?s it|thanks?|thank you|eso es todo|nada más|gracias)\b/gi

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const byLength = (a: string, b: string) => b.length - a.length
const leadRe = (words: string[]) =>
  new RegExp(`^(?:${[...words].sort(byLength).map(escape).join('|')})\\b\\s*`, 'i')
const outRe = leadRe(outLeads)
const needRe = leadRe(needLeads)
const fillerRe = leadRe(fillers)
const numberRe = new RegExp(
  `^(${Object.keys(numberWords).sort(byLength).map(escape).join('|')})\\b\\s*(?:of\\s+|de\\s+)?`,
  'i'
)

/** Drop leading filler words: "and some milk" -> "milk". */
function trimFiller(s: string): string {
  let out = s.trim()
  for (let i = 0; i < 6; i++) {
    const next = out.replace(fillerRe, '')
    if (next === out) break
    out = next
  }
  return out
}

/** Split a sentence into the things in it, without breaking "mac and cheese". */
function pieces(sentence: string): string[] {
  let s = sentence
  const saved: string[] = []
  for (const phrase of keepTogether) {
    s = s.replace(new RegExp(`\\b${escape(phrase)}\\b`, 'gi'), (m) => {
      saved.push(m)
      return `\u0000${saved.length - 1}\u0000`
    })
  }
  return s
    .split(/\s*(?:,|;|&|\+|\band\b|\by\b|\bplus\b|\balso\b|\btambién\b)\s*/i)
    .map((p) => p.replace(/\u0000(\d+)\u0000/g, (_, i: string) => saved[Number(i)]))
    .map((p) => p.trim())
    .filter(Boolean)
}

/**
 * Read a spoken or typed brain dump. Each sentence starts out as things to buy; "out of"
 * switches the rest of that sentence to things that ran out, and "need" or "get" switches back.
 */
export function parseCapture(text: string, limit = 30): CapturedItem[] {
  const out: CapturedItem[] = []
  const seen = new Set<string>()
  const sentences = text
    .replace(endings, '')
    .split(/[\n.!?¡¿]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  for (const sentence of sentences) {
    let outOf = false
    for (const raw of pieces(sentence)) {
      let p = trimFiller(raw)
      // A lead phrase can come after filler ("and we're out of"), so look twice.
      for (let i = 0; i < 2; i++) {
        if (outRe.test(p)) {
          outOf = true
          p = trimFiller(p.replace(outRe, ''))
        } else if (needRe.test(p)) {
          outOf = false
          p = trimFiller(p.replace(needRe, ''))
        }
      }
      if (!p) continue
      // "two onions" -> "2 onions", so the recipe line reader can take the amount.
      const word = p.match(numberRe)
      if (word) {
        const n = numberWords[word[1].toLowerCase()]
        // "one" on its own isn't worth saying: "one lemon" is just lemon, amount 1.
        p = `${n} ${trimFiller(p.slice(word[0].length))}`
      }
      const parsed = parseIngredientLine(p)
      const name = (parsed?.name || p).replace(/\s+/g, ' ').trim().slice(0, 60)
      if (!name || /^\d+$/.test(name)) continue
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        ...(parsed && parsed.quantity > 0
          ? { quantity: parsed.quantity, unit: parsed.unit || undefined }
          : {}),
        outOf,
      })
      if (out.length >= limit) return out
    }
  }
  return out
}
