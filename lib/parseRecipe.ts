// A forgiving, heuristic parser for pasted recipe text. No network, no model.

export interface ParsedIngredient {
  name: string
  quantity: number
  unit: string
}
export interface ParsedStep {
  text: string
  timerMinutes?: number
}
export interface ParsedRecipe {
  title?: string
  servings?: number
  activeMinutes?: number
  totalMinutes?: number
  ingredients: ParsedIngredient[]
  steps: ParsedStep[]
}

const UNITS = [
  'kg',
  'g',
  'ml',
  'l',
  'tsp',
  'tbsp',
  'cups',
  'cup',
  'cloves',
  'clove',
  'cans',
  'can',
  'bunch',
  'slices',
  'slice',
  'whole',
  'oz',
  'lb',
]
const UNIT_SET = new Set(UNITS)
const VULGAR: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 }

const ING_HEADING = /^\s*(?:#+\s*)?ingredients?\b\s*:?\s*$/i
const STEP_HEADING =
  /^\s*(?:#+\s*)?(?:method|instructions?|directions?|steps?|preparation)\b\s*:?\s*$/i

/** Finds a timer in step text: "12 minutes", "10-12 min" (takes the upper bound). */
/**
 * Minutes for a step's timer: "12 minutes", "10-12 mins", "1 hour 10 minutes",
 * "1½ hours", "90 seconds". Whole words only, so "2 minced garlic" is not a timer.
 */
export function detectTimer(text: string): number | undefined {
  const num = String.raw`(\d+(?:[.,]\d+)?|\d*[½¼¾⅓⅔])`
  const range = String.raw`${num}(?:\s*(?:-|–|to)\s*${num})?`
  const read = (a?: string, b?: string) => toNumber(b ?? a ?? '')
  let total = 0
  const hours = text.match(new RegExp(`${range}\\s*(?:hours?|hrs?)\\b`, 'i'))
  if (hours) total += read(hours[1], hours[2]) * 60
  const mins = text.match(new RegExp(`${range}\\s*(?:minutes?|mins?)\\b`, 'i'))
  if (mins) total += read(mins[1], mins[2])
  if (!hours && !mins) {
    const secs = text.match(new RegExp(`${range}\\s*(?:seconds?|secs?)\\b`, 'i'))
    if (secs) total += read(secs[1], secs[2]) / 60
  }
  return total > 0 && total < 600 ? Math.round(total * 100) / 100 : undefined
}

function toNumber(s: string): number {
  const tItem = s.replace(',', '.')
  const m = tItem.match(/^(\d*)([½¼¾⅓⅔])$/)
  if (m) return Number(m[1] || 0) + (VULGAR[m[2]] ?? 0)
  return Number(tItem) || 0
}

function parseQuantityToken(tok: string): number | undefined {
  if (VULGAR[tok] !== undefined) return VULGAR[tok]
  const mixed = tok.match(/^(\d+)([½¼¾⅓⅔])$/)
  if (mixed) return Number(mixed[1]) + VULGAR[mixed[2]]
  const range = tok.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/)
  if (range) return Number(range[1])
  const frac = tok.match(/^(\d+)\/(\d+)$/)
  if (frac && Number(frac[2]) !== 0) return Number(frac[1]) / Number(frac[2])
  if (/^\d+(?:\.\d+)?$/.test(tok)) return Number(tok)
  return undefined
}

export function parseIngredientLine(raw: string): ParsedIngredient | null {
  let line = raw.replace(/^\s*(?:[-*•–]\s+|\d+[.)]\s+(?=\D))/, '').trim()
  // "1 1/2" mixed number: merge into one token
  line = line.replace(
    /^(\d+)\s+(\d+\/\d+)/,
    (_, a: string, b: string) => `${Number(a) + parseQuantityToken(b)!}`
  )
  if (!line) return null
  const parts = line.split(/\s+/)
  let quantity = 1
  let idx = 0
  const q = parseQuantityToken(parts[0])
  if (q !== undefined) {
    quantity = Math.round(q * 100) / 100
    idx = 1
  } else {
    // quantity glued to unit: "200g"
    const glued = parts[0].match(/^(\d+(?:\.\d+)?)([a-z]+)$/i)
    if (glued && UNIT_SET.has(glued[2].toLowerCase())) {
      return finish(Number(glued[1]), glued[2].toLowerCase(), parts.slice(1))
    }
  }
  let unit = ''
  if (idx > 0 && parts[idx] && UNIT_SET.has(parts[idx].toLowerCase().replace(/[.,]$/, ''))) {
    unit = parts[idx].toLowerCase().replace(/[.,]$/, '')
    idx += 1
  }
  return finish(quantity, unit, parts.slice(idx))
}

function finish(quantity: number, unit: string, nameParts: string[]): ParsedIngredient | null {
  let name = nameParts.join(' ').replace(/^of\s+/i, '')
  name = name
    .split(',')[0]
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!name) return null
  return { name, quantity, unit }
}

function cleanStep(line: string): string {
  return line.replace(/^\s*(?:step\s*\d+\s*[:.)-]?|\d+\s*[.)])\s*/i, '').trim()
}

function isStepStart(line: string): boolean {
  return /^\s*(?:step\s*\d+|\d+\s*[.)])\s*/i.test(line)
}

function buildSteps(lines: string[]): ParsedStep[] {
  const steps: string[] = []
  const numbered = lines.some(isStepStart)
  for (const line of lines) {
    const text = cleanStep(line)
    if (!text) continue
    if (numbered) {
      if (isStepStart(line) || steps.length === 0) steps.push(text)
      else steps[steps.length - 1] += ` ${text}`
    } else {
      // Unnumbered: a line that does not start in lower case begins a new step.
      if (steps.length > 0 && /^[a-z]/.test(text) && !/[.!?]$/.test(steps[steps.length - 1]))
        steps[steps.length - 1] += ` ${text}`
      else steps.push(text)
    }
  }
  return steps.map((text) => {
    const tItem = detectTimer(text)
    return tItem ? { text, timerMinutes: tItem } : { text }
  })
}

const startsLikeIngredient = (l: string) => /^\s*(?:[-*•–]|\d|[½¼¾⅓⅔])/.test(l)

/** "1 hr 15 mins" -> 75. */
function minutesIn(s: string): number | undefined {
  const h = s.match(/(\d+(?:[.,]\d+)?)\s*(?:h|hrs?|hours?)\b/i)
  const m = s.match(/(\d+)\s*(?:m|mins?|minutes?)\b/i)
  if (!h && !m) return undefined
  const total = (h ? Number(h[1].replace(',', '.')) * 60 : 0) + (m ? Number(m[1]) : 0)
  return total > 0 && total < 48 * 60 ? Math.round(total) : undefined
}

const SERVES = /^(?:serves|servings?|makes|yield)\b\s*:?\s*(\d+)/i
const PREP = /^(?:prep(?:aration)?|active)(?:\s*time)?\s*:?\s*(.+)$/i
const COOK = /^cook(?:ing)?\s*time\s*:?\s*(.+)$/i
const TOTAL = /^(?:total|ready in)(?:\s*time)?\s*:?\s*(.+)$/i

/** Take "Serves 4", "Prep: 10 min" and the like out of the text, keeping what they say. */
function takeMeta(lines: string[], out: ParsedRecipe): string[] {
  let cook: number | undefined
  const kept = lines.filter((l) => {
    const sv = l.match(SERVES)
    if (sv) {
      const n = Number(sv[1])
      if (n >= 1 && n <= 24) out.servings = n
      return false
    }
    for (const [re, apply] of [
      [PREP, (n: number) => (out.activeMinutes = n)],
      [COOK, (n: number) => (cook = n)],
      [TOTAL, (n: number) => (out.totalMinutes = n)],
    ] as const) {
      const m = l.match(re)
      const n = m ? minutesIn(m[1]) : undefined
      if (n !== undefined && l.length < 60) {
        apply(n)
        return false
      }
    }
    return true
  })
  if (!out.totalMinutes && (out.activeMinutes || cook))
    out.totalMinutes = (out.activeMinutes ?? 0) + (cook ?? 0)
  if (!out.activeMinutes && cook && out.totalMinutes)
    out.activeMinutes = Math.min(cook, out.totalMinutes)
  return kept
}

export function parseRecipe(text: string): ParsedRecipe {
  const out: ParsedRecipe = { ingredients: [], steps: [] }
  const lines = takeMeta(
    text
      .replace(/\r/g, '')
      .split('\n')
      .map((l) => l.trim()),
    out
  )
  const nonEmpty = lines.filter(Boolean)
  if (nonEmpty.length === 0) return out

  let title: string | undefined
  let body = lines
  const first = nonEmpty[0]
  if (
    first.length < 80 &&
    !/^\d/.test(first) &&
    !ING_HEADING.test(first) &&
    !STEP_HEADING.test(first)
  ) {
    title = first.replace(/^#+\s*/, '')
    const at = lines.indexOf(first)
    body = lines.slice(at + 1)
  }
  if (title) out.title = title

  const ingAt = body.findIndex((l) => ING_HEADING.test(l))
  const stepAt = body.findIndex((l) => STEP_HEADING.test(l))

  let ingLines: string[]
  let stepLines: string[]
  if (ingAt >= 0 || stepAt >= 0) {
    if (ingAt >= 0) {
      const end = stepAt > ingAt ? stepAt : body.length
      ingLines = body.slice(ingAt + 1, end)
      stepLines = stepAt > ingAt ? body.slice(stepAt + 1) : []
    } else {
      ingLines = body.slice(0, stepAt)
      stepLines = body.slice(stepAt + 1)
    }
  } else {
    const clean = body.filter(Boolean)
    let i = 0
    while (i < clean.length && startsLikeIngredient(clean[i]) && clean[i].length <= 60) i += 1
    // Skip any non-ingredient lead-in before the first ingredient-looking line.
    if (i === 0) {
      const firstIng = clean.findIndex(startsLikeIngredient)
      if (firstIng > 0) {
        let j = firstIng
        while (j < clean.length && startsLikeIngredient(clean[j]) && clean[j].length <= 60) j += 1
        ingLines = clean.slice(firstIng, j)
        stepLines = clean.slice(j)
        return fill(out, ingLines, stepLines)
      }
    }
    ingLines = clean.slice(0, i)
    stepLines = clean.slice(i)
  }
  return fill(out, ingLines, stepLines)
}

function fill(out: ParsedRecipe, ingLines: string[], stepLines: string[]): ParsedRecipe {
  out.ingredients = ingLines
    .filter(Boolean)
    .map(parseIngredientLine)
    .filter((x): x is ParsedIngredient => x !== null)
  out.steps = buildSteps(stepLines.filter(Boolean))
  return out
}
