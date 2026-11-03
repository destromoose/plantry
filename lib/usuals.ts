// "Your usuals": the things this kitchen buys trip after trip, learnt from finished shops.

import type { Aisle, ShopItem } from './types'

export interface BoughtEntry {
  name: string
  aisle: Aisle
  /** Days (YYYY-MM-DD) it was bought, newest first, at most six. */
  trips: string[]
}

export type Bought = Record<string, BoughtEntry>

const aisles: Aisle[] = [
  'produce',
  'dairy',
  'meat-fish',
  'bakery',
  'pantry',
  'frozen',
  'spices',
  'drinks',
  'other',
]
const MAX_TRIPS = 6
const MAX_ENTRIES = 200

/** Count one trip for each item bought. Buying the same thing twice in a day is one trip. */
export function recordTrip(bought: Bought, items: ShopItem[], day: string): Bought {
  if (!items.length) return bought
  const next: Bought = { ...bought }
  for (const i of items) {
    const was = next[i.key]
    const trips = was?.trips.includes(day)
      ? was.trips
      : [day, ...(was?.trips ?? [])].slice(0, MAX_TRIPS)
    next[i.key] = { name: i.name, aisle: i.aisle, trips }
  }
  // Keep it small: forget the things bought longest ago.
  const keys = Object.keys(next)
  if (keys.length > MAX_ENTRIES)
    keys
      .sort((a, b) => (next[a].trips[0] < next[b].trips[0] ? -1 : 1))
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((k) => delete next[k])
  return next
}

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

/**
 * Bought on at least two trips, the last within six weeks, and not on the list now.
 * Most often bought first.
 */
export function usuals(
  bought: Bought,
  onList: Set<string>,
  today: string,
  limit = 8
): (BoughtEntry & { key: string })[] {
  return Object.entries(bought)
    .filter(
      ([key, e]) => e.trips.length >= 2 && !onList.has(key) && daysBetween(e.trips[0], today) <= 42
    )
    .sort(([, a], [, b]) => b.trips.length - a.trips.length || (a.trips[0] < b.trips[0] ? 1 : -1))
    .slice(0, limit)
    .map(([key, e]) => ({ key, ...e }))
}

/** Read a saved copy, dropping anything that isn't the right shape. */
export function cleanBought(raw: unknown): Bought {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Bought = {}
  for (const [key, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue
    const e = v as Partial<BoughtEntry>
    if (typeof e.name !== 'string' || !e.name.trim()) continue
    const trips = Array.isArray(e.trips)
      ? e.trips.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
      : []
    if (!trips.length) continue
    out[key] = {
      name: e.name.slice(0, 60),
      aisle: aisles.includes(e.aisle as Aisle) ? (e.aisle as Aisle) : 'other',
      trips: trips.slice(0, MAX_TRIPS),
    }
  }
  return out
}
