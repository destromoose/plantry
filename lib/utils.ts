import { esKeys } from './i18n/esKeys'
import { locale, t, tn } from '@/lib/i18n'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatAmount } from './quantity'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

let counter = 0
export function uid(prefix = 'id'): string {
  counter += 1
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`
}

// Different names for the same thing, so the pantry and the list match.
const synonyms: Record<string, string> = {
  chilli: 'chili',
  chile: 'chili',
  'chilli flake': 'chili flake',
  'red pepper flake': 'chili flake',
  'spring onion': 'scallion',
  'green onion': 'scallion',
  coriander: 'cilantro',
  'fresh coriander': 'cilantro',
  aubergine: 'eggplant',
  courgette: 'zucchini',
  capsicum: 'bell pepper',
  'red pepper': 'bell pepper',
  'green pepper': 'bell pepper',
  'yellow pepper': 'bell pepper',
  garbanzo: 'chickpea',
  'garbanzo bean': 'chickpea',
  'minced beef': 'ground beef',
  'beef mince': 'ground beef',
  'minced pork': 'ground pork',
  'pork mince': 'ground pork',
  'plain yogurt': 'yogurt',
  yoghurt: 'yogurt',
  'greek yogurt': 'yogurt',
  'extra virgin olive oil': 'olive oil',
  'chicken stock': 'stock',
  'vegetable stock': 'stock',
  'veg stock': 'stock',
  'tinned tomato': 'canned tomato',
  'chopped tomato': 'canned tomato',
  peas: 'frozen pea',
  pea: 'frozen pea',
  noodle: 'noodle',
  prawn: 'prawn',
  shrimp: 'prawn',
}

// Words that describe the thing but don't change what you buy.
const fillers = new Set([
  'large',
  'small',
  'medium',
  'big',
  'fresh',
  'freshly',
  'chopped',
  'diced',
  'minced',
  'sliced',
  'grated',
  'ripe',
  'organic',
  'whole',
  'raw',
  'dried',
  'ground-up',
  'finely',
  'roughly',
  'boneless',
  'skinless',
  'peeled',
  'crushed',
  'juiced',
  'zested',
  'a',
  'of',
])

// Plurals ending in -ies that are not -y words.
const ieWords = new Set(['cookies', 'brownies', 'pies', 'smoothies', 'veggies', 'calories', 'ties'])

/** Lowercase, singularized-ish key for matching ingredients to pantry items. */
export function keyOf(name: string): string {
  const lower = name.toLowerCase().trim()
  // Strip accents (jalapeño -> jalapeno) but keep letters and digits from any script,
  // so "2% milk", "豆腐" and "🍋" each get their own key instead of an empty one.
  const k = lower
    .replace(/\(.*?\)/g, '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
  if (!k) return lower.replace(/\s+/g, ' ')
  if (esKeys[k]) return esKeys[k]
  if (!/^[a-z ]+$/.test(k)) return k
  const words = k
    .replace(/free range/g, '')
    .split(' ')
    .filter((w) => w && !fillers.has(w))
  const plain = (words.length ? words : k.split(' ')).join(' ')
  const single = singular(plain)
  return synonyms[single] ?? synonyms[plain] ?? single
}

function singular(k: string): string {
  const last = k.split(' ').pop() ?? k
  if (ieWords.has(last)) return k.slice(0, -1)
  if (k.endsWith('oes')) return k.slice(0, -2)
  if (k.endsWith('ies')) return k.slice(0, -3) + 'y'
  if (k.endsWith('s') && !k.endsWith('ss') && !k.endsWith('us')) return k.slice(0, -1)
  return k
}

/** 1 when just bought, 0 when past its soft life. One rule for the Pantry and suggestions. */
export function freshnessOf(item: { addedAt: string; softLifeDays: number }, today: string) {
  const age = Math.max(0, daysBetween(item.addedAt.slice(0, 10), today))
  return clamp(1 - age / Math.max(1, item.softLifeDays), 0, 1)
}

/** Use it soon: less than 40% of its life left. */
export const USE_SOON = 0.4
export const isUseSoon = (item: { addedAt: string; softLifeDays: number }, today: string) =>
  freshnessOf(item, today) < USE_SOON

export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, n: number): string {
  const d = fromDateKey(key)
  d.setDate(d.getDate() + n)
  return toDateKey(d)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((fromDateKey(b).getTime() - fromDateKey(a).getTime()) / 86_400_000)
}

/** Monday-start week containing the given date key. */
export function weekOf(key: string): string[] {
  const d = fromDateKey(key)
  const dow = (d.getDay() + 6) % 7
  const start = addDays(key, -dow)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function dayLabel(key: string, today: string): string {
  const diff = daysBetween(today, key)
  if (diff === 0) return t('Today')
  if (diff === 1) return t('Tomorrow')
  if (diff === -1) return t('Yesterday')
  return fromDateKey(key).toLocaleDateString(locale(), { weekday: 'long' })
}

export function shortDay(key: string): string {
  return fromDateKey(key).toLocaleDateString(locale(), { weekday: 'short' })
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? t('{h} h {m} min', { h, m }) : `${h} h`
}

/** Kept for existing callers; see lib/quantity.ts. */
export function formatQuantity(q?: number, unit?: string): string {
  return formatAmount(q, unit)
}

/** "1 thing", "3 things"; in Spanish "1 cosa", "3 cosas". */
export function pluralize(n: number, word: string, plural = word + 's'): string {
  return tn(n, word, plural)
}

export function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}
