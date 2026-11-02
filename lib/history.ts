// The cooking history: what was cooked, when, by whom, and how it went.
// Pure functions over the `cooked` log so screens and the suggestion ranker agree.

import type { CookedEntry, Rating } from './types'
import { daysBetween, fromDateKey } from './utils'

export const ratingLabels: Record<Rating, string> = {
  loved: 'Loved it',
  fine: 'Fine',
  'not-again': 'Not again',
}

export interface RecipeHistory {
  times: number
  lastDate?: string
  /** The latest rating anyone gave it. */
  rating?: Rating
  /** The latest note left for it. */
  note?: string
}

/** How often a recipe was cooked, when it last was, and how it last went. */
export function historyFor(recipeId: string, cooked: CookedEntry[]): RecipeHistory {
  const mine = cooked.filter((c) => c.recipeId === recipeId)
  return {
    times: mine.length,
    lastDate: mine.reduce<string | undefined>((a, c) => (!a || c.date > a ? c.date : a), undefined),
    rating: latest(mine, (c) => c.rating),
    note: latest(mine, (c) => c.note),
  }
}

function latest<T>(list: CookedEntry[], pick: (c: CookedEntry) => T | undefined): T | undefined {
  let best: { date: string; v: T } | undefined
  for (const c of list) {
    const v = pick(c)
    if (v !== undefined && (!best || c.date > best.date)) best = { date: c.date, v }
  }
  return best?.v
}

/** The latest rating for every recipe that has one, for the suggestion ranker. */
export function ratingsOf(cooked: CookedEntry[]): Record<string, Rating> {
  const out: Record<string, { date: string; r: Rating }> = {}
  for (const c of cooked) {
    if (!c.rating || !c.recipeId) continue
    const cur = out[c.recipeId]
    if (!cur || c.date >= cur.date) out[c.recipeId] = { date: c.date, r: c.rating }
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.r]))
}

/** Newest first, grouped by month: [{ key: '2026-10', entries }]. */
export function byMonth(cooked: CookedEntry[]) {
  const sorted = [...cooked]
    .map((c, index) => ({ ...c, index }))
    .filter((c) => c.recipeId)
    .sort((a, b) => (a.date === b.date ? a.index - b.index : a.date < b.date ? 1 : -1))
  const groups: { key: string; entries: typeof sorted }[] = []
  for (const c of sorted) {
    const key = c.date.slice(0, 7)
    const last = groups[groups.length - 1]
    if (last?.key === key) last.entries.push(c)
    else groups.push({ key, entries: [c] })
  }
  return groups
}

export const monthLabel = (key: string, locale?: string) =>
  fromDateKey(`${key}-01`).toLocaleDateString(locale, { month: 'long', year: 'numeric' })

/** The recipes cooked most, most first. */
export function mostCooked(cooked: CookedEntry[], limit = 3) {
  const counts = new Map<string, number>()
  for (const c of cooked) if (c.recipeId) counts.set(c.recipeId, (counts.get(c.recipeId) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([recipeId, times]) => ({ recipeId, times }))
}

/** "today", "yesterday", "5 days ago", "3 weeks ago", "in March". */
export function agoLabel(date: string, today: string) {
  const d = daysBetween(date, today)
  if (d <= 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 14) return `${d} days ago`
  if (d < 60) return `${Math.round(d / 7)} weeks ago`
  return `in ${fromDateKey(date).toLocaleDateString(undefined, { month: 'long' })}`
}
