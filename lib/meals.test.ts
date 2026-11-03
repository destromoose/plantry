import { describe, expect, it } from 'vitest'
import { lunchFromLastNight, mealLabel, mealUsuals, plannedMeals, smallMeals } from './meals'
import { defaultSettings } from './schema'
import type { PlanEntry, Recipe } from './types'

const r = (id: string, title: string) => ({ id, title }) as Recipe
const recipes = [r('a', 'Chili'), r('b', 'Granola')]
const e = (date: string, slot: PlanEntry['slot'], x: Partial<PlanEntry>): PlanEntry => ({
  id: `${date}-${slot}`,
  date,
  slot,
  ...x,
})

describe('meals', () => {
  it('always keeps dinner and orders the day', () => {
    expect(plannedMeals(['lunch'])).toEqual(['lunch', 'dinner'])
    expect(plannedMeals(undefined)).toEqual(['breakfast', 'lunch', 'dinner'])
    expect(smallMeals(['dinner'])).toEqual([])
  })

  it('learns usuals per meal, most often first', () => {
    const plan = [
      e('2026-11-01', 'breakfast', { note: 'Oats' }),
      e('2026-11-02', 'breakfast', { note: 'oats ' }),
      e('2026-11-03', 'breakfast', { recipeId: 'b' }),
      e('2026-11-03', 'lunch', { note: 'Soup' }),
      e('2026-08-01', 'breakfast', { note: 'Old toast' }),
    ]
    const u = mealUsuals(plan, recipes, 'breakfast', '2026-11-03')
    expect(u.map((x) => x.label)).toEqual(['Oats', 'Granola'])
    expect(u[0].count).toBe(2)
  })

  it('offers last night as lunch', () => {
    const plan = [e('2026-11-02', 'dinner', { recipeId: 'a' })]
    expect(lunchFromLastNight(plan, recipes, '2026-11-03')?.title).toBe('Chili')
    expect(lunchFromLastNight(plan, recipes, '2026-11-04')).toBeUndefined()
    expect(mealLabel(e('2026-11-03', 'lunch', { leftoversOf: 'a' }), recipes)).toBe('Chili')
  })

  it('defaults old saves to all three meals', () => {
    expect(defaultSettings.meals).toEqual(['breakfast', 'lunch', 'dinner'])
  })
})
