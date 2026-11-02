import { getLang } from './i18n'

// Amounts: convert, add up, subtract and print them so lists read like a person wrote them.

export interface Amount {
  quantity: number
  unit: string
}

type Dim = 'mass' | 'volume'
const units: Record<string, { dim: Dim; factor: number }> = {
  g: { dim: 'mass', factor: 1 },
  gram: { dim: 'mass', factor: 1 },
  grams: { dim: 'mass', factor: 1 },
  kg: { dim: 'mass', factor: 1000 },
  oz: { dim: 'mass', factor: 28.35 },
  lb: { dim: 'mass', factor: 453.6 },
  ml: { dim: 'volume', factor: 1 },
  l: { dim: 'volume', factor: 1000 },
  litre: { dim: 'volume', factor: 1000 },
  liter: { dim: 'volume', factor: 1000 },
  tsp: { dim: 'volume', factor: 5 },
  tbsp: { dim: 'volume', factor: 15 },
  cup: { dim: 'volume', factor: 240 },
  cups: { dim: 'volume', factor: 240 },
  quart: { dim: 'volume', factor: 960 },
  quarts: { dim: 'volume', factor: 960 },
  pint: { dim: 'volume', factor: 480 },
  gallon: { dim: 'volume', factor: 3840 },
  'fl oz': { dim: 'volume', factor: 29.57 },
  pound: { dim: 'mass', factor: 453.6 },
  pounds: { dim: 'mass', factor: 453.6 },
  ounce: { dim: 'mass', factor: 28.35 },
  ounces: { dim: 'mass', factor: 28.35 },
  lbs: { dim: 'mass', factor: 453.6 },
}

/** Units that mean "a number of things": shown as whole numbers on a shopping list. */
const countUnits = new Set([
  '',
  'whole',
  'clove',
  'slice',
  'can',
  'tin',
  'bunch',
  'piece',
  'pack',
  'jar',
  'head',
  'sprig',
  'stalk',
  'fillet',
  'handful',
  'pinch',
])

const norm = (u: string) =>
  u
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/s$/, (m) => (units[u.trim().toLowerCase()] ? m : ''))

export function unitInfo(unit: string) {
  const u = unit.trim().toLowerCase()
  return units[u] ?? units[norm(u)]
}

export const isCountUnit = (unit = '') =>
  countUnits.has(norm(unit)) || countUnits.has(unit.trim().toLowerCase())

/** Same kind of unit, so the two can be added up. */
export function compatible(a: string, b: string) {
  const x = unitInfo(a)
  const y = unitInfo(b)
  if (x && y) return x.dim === y.dim
  return !x && !y && norm(a) === norm(b)
}

/** Convert b into a's unit. Only call when compatible. */
function convert(q: number, from: string, to: string) {
  const f = unitInfo(from)
  const tItem = unitInfo(to)
  if (!f || !tItem) return q
  return (q * f.factor) / tItem.factor
}

/** Add an amount to a list of amounts, merging where the units allow and keeping a new line otherwise. */
export function addAmount(list: Amount[], add: Amount): Amount[] {
  const i = list.findIndex((a) => compatible(a.unit, add.unit))
  if (i === -1) return [...list, { ...add }]
  const out = [...list]
  const base = out[i]
  // Add in the larger unit's terms to keep small spoon amounts from looking odd.
  const bf = unitInfo(base.unit)?.factor ?? 1
  const af = unitInfo(add.unit)?.factor ?? 1
  const target = af > bf ? add.unit : base.unit
  out[i] = {
    unit: target,
    quantity: convert(base.quantity, base.unit, target) + convert(add.quantity, add.unit, target),
  }
  return out
}

/** What is left to buy after using what you have. Undefined when `have` can't be compared. */
export function subtract(need: Amount, have: Amount): Amount | undefined {
  if (!compatible(need.unit, have.unit)) return undefined
  const left = need.quantity - convert(have.quantity, have.unit, need.unit)
  return { unit: need.unit, quantity: Math.max(0, left) }
}

export type UnitSystem = 'metric' | 'imperial'

/** Round to the nearest step, never down to zero. */
const roundTo = (q: number, step: number) => Math.max(step, Math.round(q / step) * step)

/**
 * Show an amount in the kitchen's own units. Metric kitchens keep spoons but get grams and
 * millilitres for cups, ounces and pounds; imperial kitchens get ounces, pounds, cups and
 * spoons for grams and millilitres. Counted things ("2 cloves") never change.
 */
export function toSystem(a: Amount, system: UnitSystem): Amount {
  const info = unitInfo(a.unit)
  if (!info) return a
  const f = info.factor
  const imperialMass = f === 28.35 || f === 453.6
  const imperialVolume = f === 29.57 || f === 240 || f === 960
  const base = a.quantity * info.factor // grams or millilitres
  if (system === 'metric') {
    if (info.dim === 'mass') {
      if (imperialMass) return { quantity: roundTo(base, base < 100 ? 5 : 10), unit: 'g' }
      return a
    }
    if (imperialVolume) return { quantity: roundTo(base, base < 100 ? 5 : 10), unit: 'ml' }
    return a
  }
  if (info.dim === 'mass') {
    if (imperialMass) return a
    const oz = base / 28.35
    if (oz >= 16) return { quantity: roundTo(oz / 16, 0.25), unit: 'lb' }
    return { quantity: roundTo(oz, oz < 4 ? 0.25 : 0.5), unit: 'oz' }
  }
  // Volume: spoons stay spoons; millilitres and litres become the nearest spoon or cup.
  if (f === 5 || f === 15 || imperialVolume) return a
  if (base < 15) return { quantity: roundTo(base / 5, 0.25), unit: 'tsp' }
  if (base < 60) return { quantity: roundTo(base / 15, 0.5), unit: 'tbsp' }
  const cups = base / 240
  if (cups > 8) return { quantity: roundTo(cups / 4, 0.25), unit: 'quart' }
  return { quantity: roundTo(cups, 0.25), unit: 'cup' }
}

/**
 * Oven and pan temperatures: "Bake at 200°C" reads "Bake at 200°C (390°F)" in metric and
 * "Bake at 390°F (200°C)" in imperial. Fahrenheit rounds to the nearest 5, like oven dials.
 */
export function withTemperatures(text: string, system: UnitSystem = 'metric'): string {
  return text.replace(/(\d{2,3})\s?°\s?C\b(?!\s*\()/g, (m, c: string) => {
    const f = Math.round(((Number(c) * 9) / 5 + 32) / 5) * 5
    return system === 'imperial' ? `${f}°F (${c}°C)` : `${m} (${f}°F)`
  })
}

const fractions: [number, string][] = [
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [1 / 2, '½'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [7 / 8, '⅞'],
]

export function niceNumber(q: number): string {
  if (Math.abs(q - Math.round(q)) < 0.02 || q >= 10) return String(Math.round(q))
  const whole = Math.floor(q)
  const frac = q - whole
  const hit = fractions.find(([v]) => Math.abs(v - frac) < 0.02)
  if (hit) return whole ? `${whole}${hit[1]}` : hit[1]
  return q.toFixed(1).replace(/\.0$/, '')
}

const plural: Record<string, string> = {
  clove: 'cloves',
  slice: 'slices',
  can: 'cans',
  tin: 'tins',
  bunch: 'bunches',
  piece: 'pieces',
  pack: 'packs',
  jar: 'jars',
  head: 'heads',
  sprig: 'sprigs',
  stalk: 'stalks',
  fillet: 'fillets',
  handful: 'handfuls',
  cup: 'cups',
  quart: 'quarts',
  pint: 'pints',
  gallon: 'gallons',
  pinch: 'pinches',
}

/**
 * "12 cloves", "2.4 kg", "1½ tbsp", "3" (for eggs). `forShopping` rounds things you
 * count up to whole numbers, because nobody buys 10½ eggs.
 */
export function formatAmount(
  q?: number,
  unit = '',
  opts: { forShopping?: boolean; system?: UnitSystem } = {}
): string {
  if (opts.system && q !== undefined && Number.isFinite(q) && q > 0) {
    const c = toSystem({ quantity: q, unit }, opts.system)
    q = c.quantity
    unit = c.unit
  }
  const u = unit.trim()
  if (q === undefined || !Number.isFinite(q) || q <= 0) return u === 'whole' ? '' : u
  let n = q
  let shown = u
  const lower = u.toLowerCase()
  if (lower === 'g' && n >= 1000) {
    n /= 1000
    shown = 'kg'
  } else if (lower === 'ml' && n >= 1000) {
    n /= 1000
    shown = 'l'
  }
  if (opts.forShopping && isCountUnit(u)) n = Math.ceil(n - 0.01)
  const num = niceNumber(n)
  if (!shown || lower === 'whole') return num
  const many = n > 1 + 1e-9
  if (getLang() === 'es') {
    const es = spanishUnits[shown.toLowerCase()]
    if (es) return `${num} ${many ? es[1] : es[0]}`
  }
  const word = many ? (plural[shown.toLowerCase()] ?? shown) : shown
  return `${num} ${word}`
}

/** Unit words in Spanish: [one, many]. Metric symbols stay as they are. */
const spanishUnits: Record<string, [string, string]> = {
  clove: ['diente', 'dientes'],
  slice: ['rebanada', 'rebanadas'],
  can: ['lata', 'latas'],
  tin: ['lata', 'latas'],
  bunch: ['manojo', 'manojos'],
  piece: ['pieza', 'piezas'],
  pack: ['paquete', 'paquetes'],
  jar: ['frasco', 'frascos'],
  head: ['cabeza', 'cabezas'],
  sprig: ['ramita', 'ramitas'],
  stalk: ['tallo', 'tallos'],
  fillet: ['filete', 'filetes'],
  handful: ['puñado', 'puñados'],
  pinch: ['pizca', 'pizcas'],
  cup: ['taza', 'tazas'],
  quart: ['cuarto', 'cuartos'],
  tbsp: ['cda', 'cdas'],
  tsp: ['cdta', 'cdtas'],
}

export const formatAmounts = (
  list: Amount[],
  opts?: { forShopping?: boolean; system?: UnitSystem }
) =>
  list
    .map((a) => formatAmount(a.quantity, a.unit, opts))
    .filter(Boolean)
    .join(' + ')

const VULGAR: Record<string, number> = {
  '½': 0.5,
  '¼': 0.25,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 0.125,
}

/**
 * Read an amount someone typed: "2", "1.5", "1,5", "3/4", "1 1/2", "1½", "½".
 * Returns undefined for anything else (negative numbers, "1e3", words).
 */
export function parseAmount(input: string): number | undefined {
  const s = input.trim().replace(/\s+/g, ' ')
  if (!s) return undefined
  const v = s.match(/^(\d+)? ?([½¼¾⅓⅔⅛])$/)
  if (v) return Number(v[1] ?? 0) + VULGAR[v[2]]
  const mixed = s.match(/^(\d+) (\d+)\/(\d+)$/)
  if (mixed && Number(mixed[3])) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
  const frac = s.match(/^(\d+)\/(\d+)$/)
  if (frac) return Number(frac[2]) ? Number(frac[1]) / Number(frac[2]) : undefined
  if (/^\d+(?:[.,]\d+)?$/.test(s) || /^[.,]\d+$/.test(s)) return Number(s.replace(',', '.'))
  return undefined
}
