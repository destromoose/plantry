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
  ingredients: ParsedIngredient[]
  steps: ParsedStep[]
}

const UNITS = [
  'kg', 'g', 'ml', 'l', 'tsp', 'tbsp', 'cups', 'cup', 'cloves', 'clove', 'cans', 'can',
  'bunch', 'slices', 'slice', 'whole', 'oz', 'lb',
]
const UNIT_SET = new Set(UNITS)
const VULGAR: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 }

const ING_HEADING = /^\s*(?:#+\s*)?ingredients?\b\s*:?\s*$/i
const STEP_HEADING = /^\s*(?:#+\s*)?(?:method|instructions?|directions?|steps?|preparation)\b\s*:?\s*$/i

/** Finds a timer in step text: "12 minutes", "10-12 min" (takes the upper bound). */
export function detectTimer(text: string): number | undefined {
  const m = text.match(/(\d+)\s*(?:-|–|to)?\s*(\d+)?\s*(?:min|minute)/i)
  if (!m) return undefined
  const n = Number(m[2] ?? m[1])
  return n > 0 && n < 600 ? n : undefined
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
  line = line.replace(/^(\d+)\s+(\d+\/\d+)/, (_, a: string, b: string) => `${Number(a) + parseQuantityToken(b)!}`)
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
  name = name.split(',')[0].replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim()
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
      if (steps.length > 0 && /^[a-z]/.test(text) && !/[.!?]$/.test(steps[steps.length - 1])) steps[steps.length - 1] += ` ${text}`
      else steps.push(text)
    }
  }
  return steps.map((text) => {
    const t = detectTimer(text)
    return t ? { text, timerMinutes: t } : { text }
  })
}

const startsLikeIngredient = (l: string) => /^\s*(?:[-*•–]|\d|[½¼¾⅓⅔])/.test(l)

export function parseRecipe(text: string): ParsedRecipe {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trim())
  const nonEmpty = lines.filter(Boolean)
  const out: ParsedRecipe = { ingredients: [], steps: [] }
  if (nonEmpty.length === 0) return out

  let title: string | undefined
  let body = lines
  const first = nonEmpty[0]
  if (first.length < 80 && !/^\d/.test(first) && !ING_HEADING.test(first) && !STEP_HEADING.test(first)) {
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
