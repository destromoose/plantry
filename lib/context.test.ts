import { describe, expect, it } from 'vitest'
import { buildContext, moodForHour, weatherLean } from './context'
import type { PlanEntry, Recipe } from './types'

function recipe(id: string, aisle: 'meat-fish' | 'produce' = 'produce'): Recipe {
  return {
    id,
    title: id,
    description: '',
    activeMinutes: 20,
    totalMinutes: 30,
    servings: 2,
    ingredients: [{ id: `${id}-i1`, name: 'Thing', key: 'thing', quantity: 1, unit: '', aisle }],
    steps: [],
    tastes: [],
    isFavorite: false,
    createdAt: '2026-01-01',
  }
}

const settings = { mood: 'auto' as const, weatherEnabled: false }
const dinner = (date: string, recipeId: string): PlanEntry => ({
  id: `pl-${date}`,
  date,
  slot: 'dinner',
  recipeId,
})

describe('moodForHour', () => {
  it('has the right boundaries', () => {
    expect(moodForHour(4)).toBe('night')
    expect(moodForHour(5)).toBe('dawn')
    expect(moodForHour(9)).toBe('dawn')
    expect(moodForHour(10)).toBe('day')
    expect(moodForHour(16)).toBe('day')
    expect(moodForHour(17)).toBe('dusk')
    expect(moodForHour(20)).toBe('dusk')
    expect(moodForHour(21)).toBe('night')
    expect(moodForHour(0)).toBe('night')
  })
})

describe('buildContext', () => {
  it('stays on tonight at 21:30 and after midnight', () => {
    const at2130 = buildContext({
      now: new Date(2026, 10, 3, 21, 30),
      settings,
      plan: [],
      recipes: [],
    })
    expect(at2130.targetDate).toBe('2026-11-03')
    // 01:00 on the 4th: the dinner to think about is the 4th, not the 5th.
    const at1am = buildContext({
      now: new Date(2026, 10, 4, 1, 0),
      settings,
      plan: [],
      recipes: [],
    })
    expect(at1am.targetDate).toBe('2026-11-04')
  })

  it('keeps an uncooked planned dinner on screen late, and can be asked to stay', () => {
    const plan = [dinner('2026-11-03', 'r1')]
    const planned = buildContext({
      now: new Date(2026, 10, 3, 22, 30),
      settings,
      plan,
      recipes: [recipe('r1')],
    })
    expect(planned.targetDate).toBe('2026-11-03')
    const asked = buildContext({
      now: new Date(2026, 10, 3, 22, 30),
      settings,
      plan: [],
      recipes: [],
      stillTonight: true,
    })
    expect(asked.targetDate).toBe('2026-11-03')
  })

  it('targets tomorrow after 22:00 and tonight at 18:00', () => {
    const late = buildContext({
      now: new Date(2026, 10, 3, 22, 30),
      settings,
      plan: [],
      recipes: [],
    })
    expect(late.targetLabel).toBe('Tomorrow')
    expect(late.targetDate).toBe('2026-11-04')
    const evening = buildContext({
      now: new Date(2026, 10, 3, 18, 0),
      settings,
      plan: [],
      recipes: [],
    })
    expect(evening.targetLabel).toBe('Tonight')
    expect(evening.targetDate).toBe('2026-11-03')
  })

  it('nudges to plan the week on a Saturday morning with an empty plan', () => {
    const ctx = buildContext({ now: new Date(2026, 10, 7, 9, 0), settings, plan: [], recipes: [] })
    expect(ctx.isWeekend).toBe(true)
    expect(ctx.nudge).toBe('plan-week')
  })

  it('nudges to start now on a Tuesday evening with a planned dinner', () => {
    const r = recipe('soup')
    const ctx = buildContext({
      now: new Date(2026, 10, 3, 17, 30),
      settings,
      plan: [dinner('2026-11-03', 'soup')],
      recipes: [r],
    })
    expect(ctx.nudge).toBe('start-now')
  })

  it('nudges to defrost in the morning when dinner has meat or fish', () => {
    const r = recipe('chicken', 'meat-fish')
    const ctx = buildContext({
      now: new Date(2026, 10, 3, 9, 0),
      settings,
      plan: [dinner('2026-11-03', 'chicken')],
      recipes: [r],
    })
    expect(ctx.nudge).toBe('defrost')
  })
})

describe('weatherLean', () => {
  it('leans warm when cold and rainy, light when hot', () => {
    const base = { fetchedAt: '2026-11-03T00:00:00Z' }
    expect(weatherLean({ tempC: 5, precipitation: true, ...base })).toBe('warm')
    expect(weatherLean({ tempC: 30, precipitation: false, ...base })).toBe('light')
    expect(weatherLean({ tempC: 18, precipitation: false, ...base })).toBe('any')
    expect(weatherLean(undefined)).toBe('any')
  })

  it('moves on to tomorrow once tonight is cooked', () => {
    const plan = [{ ...dinner('2026-11-03', 'r1'), done: true }]
    const c = buildContext({
      now: new Date(2026, 10, 3, 19, 0),
      settings,
      plan,
      recipes: [recipe('r1')],
    })
    expect(c.targetDate).toBe('2026-11-04')
    expect(c.canStayTonight).toBe(false)
  })
})
