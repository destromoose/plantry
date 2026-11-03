// Planning further ahead together: meals that repeat every week, copying last week, the
// household's pool of ideas, and the month at a glance. Pure helpers; the store keeps the data.

import type { MealIdea, MealSlot, PlanEntry, RepeatMeal } from './types'
import { addDays, fromDateKey } from './utils'
import { t } from './i18n'

const decided = (e?: PlanEntry) => !!e && !!(e.recipeId || e.leftoversOf || e.note)

/** The weekly meal for this date and slot, if the household has one. */
export function repeatFor(
  repeats: RepeatMeal[],
  date: string,
  slot: MealSlot
): RepeatMeal | undefined {
  const dow = fromDateKey(date).getDay()
  return repeats.find((r) => r.weekday === dow && r.slot === slot)
}

/**
 * Last week's meals onto this week's empty slots, from today on. Leftovers are left out:
 * they only make sense the day after the meal they came from. Returns what to plan.
 */
export function copyWeek(
  plan: PlanEntry[],
  toDates: string[],
  today: string
): Omit<PlanEntry, 'id'>[] {
  const at = (d: string, slot: MealSlot) => plan.find((p) => p.date === d && p.slot === slot)
  const out: Omit<PlanEntry, 'id'>[] = []
  for (const date of toDates) {
    if (date < today) continue
    for (const slot of ['breakfast', 'lunch', 'dinner'] as MealSlot[]) {
      if (decided(at(date, slot))) continue
      const was = at(addDays(date, -7), slot)
      if (
        !was ||
        !(was.recipeId || was.note) ||
        was.note === 'Not cooking' ||
        was.note === t('Not cooking')
      )
        continue
      out.push({
        date,
        slot,
        recipeId: was.recipeId,
        note: was.recipeId ? undefined : was.note,
        cookId: at(date, slot)?.cookId ?? was.cookId,
      })
    }
  }
  return out
}

/** Weekly meals onto this week's empty slots, from today on. */
export function repeatsInto(
  plan: PlanEntry[],
  repeats: RepeatMeal[],
  dates: string[],
  today: string
): Omit<PlanEntry, 'id'>[] {
  const out: Omit<PlanEntry, 'id'>[] = []
  for (const date of dates) {
    if (date < today) continue
    // Two phones can each set a weekly meal for the same night before syncing: the first wins,
    // as in repeatFor.
    const seen = new Set<string>()
    for (const r of repeats) {
      if (r.weekday !== fromDateKey(date).getDay() || seen.has(r.slot)) continue
      seen.add(r.slot)
      const cur = plan.find((p) => p.date === date && p.slot === r.slot)
      if (decided(cur)) continue
      out.push({ date, slot: r.slot, recipeId: r.recipeId, note: r.note, cookId: cur?.cookId })
    }
  }
  return out
}

/** Ideas with the most "me too" first, then the newest. */
export function rankIdeas(ideas: MealIdea[]): MealIdea[] {
  return [...ideas].sort(
    (a, b) => (b.votes?.length ?? 0) - (a.votes?.length ?? 0) || (a.at < b.at ? 1 : -1)
  )
}

/** Monday-first weeks covering a month: 5 or 6 rows of 7 dates. */
export function monthGrid(year: number, month: number): string[][] {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - lead)
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const last = new Date(year, month + 1, 0).getDate()
  const rows = Math.ceil((lead + last) / 7)
  return Array.from({ length: rows }, (_, w) =>
    Array.from({ length: 7 }, (_, i) =>
      key(new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + i))
    )
  )
}
