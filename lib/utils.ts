import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

let counter = 0
export function uid(prefix = 'id'): string {
  counter += 1
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`
}

/** Lowercase, singularized-ish key for matching ingredients to pantry items. */
export function keyOf(name: string): string {
  const k = name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
  if (k.endsWith('oes')) return k.slice(0, -2)
  if (k.endsWith('ies')) return k.slice(0, -3) + 'y'
  if (k.endsWith('s') && !k.endsWith('ss')) return k.slice(0, -1)
  return k
}

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
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return fromDateKey(key).toLocaleDateString(undefined, { weekday: 'long' })
}

export function shortDay(key: string): string {
  return fromDateKey(key).toLocaleDateString(undefined, { weekday: 'short' })
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export function formatQuantity(q?: number, unit?: string): string {
  if (q === undefined || q === 0) return unit ?? ''
  const nice = Number.isInteger(q) ? String(q) : fractionOf(q)
  return unit ? `${nice} ${unit}` : nice
}

function fractionOf(q: number): string {
  const whole = Math.floor(q)
  const frac = q - whole
  const map: [number, string][] = [
    [0.25, '¼'],
    [0.33, '⅓'],
    [0.5, '½'],
    [0.66, '⅔'],
    [0.75, '¾'],
  ]
  const hit = map.find(([v]) => Math.abs(v - frac) < 0.08)
  if (!hit) return q.toFixed(1).replace(/\.0$/, '')
  return whole ? `${whole}${hit[1]}` : hit[1]
}

export function pluralize(n: number, word: string, plural = word + 's'): string {
  return `${n} ${n === 1 ? word : plural}`
}

export function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}
