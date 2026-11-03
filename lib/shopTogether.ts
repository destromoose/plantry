// Shopping together: who's out shopping, what got added while they're there, and splitting
// one list between two people. Pure helpers; the store keeps the data and syncs it.

import type { Aisle, ShopItem, ShopTrip } from './types'

/** A trip counts for three hours, so a forgotten "Done" doesn't leave it on forever. */
export const TRIP_HOURS = 3

export function activeTrip(
  trip: ShopTrip | undefined,
  now = Date.now()
): Required<ShopTrip> | undefined {
  if (!trip?.by || !trip.since) return undefined
  const since = new Date(trip.since).getTime()
  if (Number.isNaN(since) || now - since > TRIP_HOURS * 3_600_000) return undefined
  return { by: trip.by, since: trip.since }
}

/** Put on the list by someone else after the shopper set off: worth a highlight. */
export function isLateAdd(item: ShopItem, trip: Required<ShopTrip> | undefined): boolean {
  return !!trip && !!item.addedAt && item.addedAt > trip.since && item.addedBy !== trip.by
}

/**
 * Split the list by aisle so each person walks their own part of the shop. Bigger aisles
 * go first to whoever has least so far. Returns who gets each item.
 */
export function splitByAisle(items: ShopItem[], people: string[]): Record<string, string> {
  if (people.length < 2) return {}
  const open = items.filter((i) => !i.checked)
  const byAisle = new Map<Aisle, ShopItem[]>()
  for (const i of open) byAisle.set(i.aisle, [...(byAisle.get(i.aisle) ?? []), i])
  const load = new Map(people.map((p) => [p, 0]))
  const out: Record<string, string> = {}
  for (const [, list] of [...byAisle].sort((a, b) => b[1].length - a[1].length)) {
    const who = [...load].sort((a, b) => a[1] - b[1])[0][0]
    for (const i of list) out[i.id] = who
    load.set(who, (load.get(who) ?? 0) + list.length)
  }
  return out
}
