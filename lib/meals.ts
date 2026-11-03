// Breakfast and lunch next to dinner: which meals a household plans, what it usually has,
// and last night's dinner as today's lunch.

import type { MealSlot, PlanEntry, Recipe } from './types'
import { addDays } from './utils'

export const ALL_MEALS: MealSlot[] = ['breakfast', 'lunch', 'dinner']

/** The meals a household plans, in day order. Dinner is always there. */
export function plannedMeals(meals: MealSlot[] | undefined): MealSlot[] {
  const set = new Set<MealSlot>([...(meals ?? ALL_MEALS), 'dinner'])
  return ALL_MEALS.filter((m) => set.has(m))
}

/** The small meals (not dinner) shown on each day. */
export function smallMeals(meals: MealSlot[] | undefined): MealSlot[] {
  return plannedMeals(meals).filter((m) => m !== 'dinner')
}

export function entryFor(plan: PlanEntry[], date: string, slot: MealSlot) {
  return plan.find((p) => p.date === date && p.slot === slot)
}

export function isDecided(e: PlanEntry | undefined): boolean {
  return !!e && !!(e.recipeId || e.leftoversOf || e.note)
}

/** What a meal entry is called: a recipe title, "Leftovers: …", or its note. */
export function mealLabel(e: PlanEntry | undefined, recipes: Recipe[]): string | undefined {
  if (!e) return undefined
  if (e.recipeId) return recipes.find((r) => r.id === e.recipeId)?.title
  if (e.leftoversOf) {
    const r = recipes.find((x) => x.id === e.leftoversOf)
    return r ? r.title : undefined
  }
  return e.note || undefined
}

export interface MealUsual {
  /** A recipe id, or undefined for a plain note like "Oats". */
  recipeId?: string
  note?: string
  label: string
  count: number
}

/**
 * What this household usually has for a meal, learnt from the plan: the notes and recipes
 * put in that slot in the last eight weeks, most often first. Nothing to set up.
 */
export function mealUsuals(
  plan: PlanEntry[],
  recipes: Recipe[],
  slot: MealSlot,
  today: string,
  limit = 6
): MealUsual[] {
  const since = addDays(today, -56)
  const seen = new Map<string, MealUsual & { last: string }>()
  for (const p of plan) {
    if (p.slot !== slot || p.date < since || p.leftoversOf) continue
    let key: string | undefined
    let u: MealUsual | undefined
    if (p.recipeId) {
      const r = recipes.find((x) => x.id === p.recipeId)
      if (!r) continue
      key = `r:${r.id}`
      u = { recipeId: r.id, label: r.title, count: 0 }
    } else if (p.note?.trim()) {
      const note = p.note.trim()
      key = `n:${note.toLowerCase()}`
      u = { note, label: note, count: 0 }
    }
    if (!key || !u) continue
    const was = seen.get(key)
    seen.set(key, {
      ...(was ?? u),
      count: (was?.count ?? 0) + 1,
      last: was && was.last > p.date ? was.last : p.date,
    })
  }
  return [...seen.values()]
    .sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : -1))
    .slice(0, limit)
    .map(({ last: _last, ...u }) => u)
}

/** Last night's dinner, when it was a recipe worth having again for lunch today. */
export function lunchFromLastNight(
  plan: PlanEntry[],
  recipes: Recipe[],
  date: string
): Recipe | undefined {
  const prev = entryFor(plan, addDays(date, -1), 'dinner')
  const id = prev?.recipeId ?? prev?.leftoversOf
  return id ? recipes.find((r) => r.id === id) : undefined
}
