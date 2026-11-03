import { describe, expect, it } from 'vitest'
import { copyWeek, monthGrid, rankIdeas, repeatFor, repeatsInto } from './planTogether'
import { mergeDocs, emptyDoc } from './syncDoc'
import type { MealIdea, PlanEntry, RepeatMeal } from './types'
import { weekOf } from './utils'

// 2026-11-03 is a Tuesday; its week runs Monday 2 to Sunday 8.
const today = '2026-11-03'
const week = weekOf(today)
const e = (date: string, patch: Partial<PlanEntry> = {}): PlanEntry => ({
  id: `${date}-${patch.slot ?? 'dinner'}`,
  date,
  slot: 'dinner',
  ...patch,
})

describe('copyWeek', () => {
  it('copies last week onto empty slots from today on, skipping leftovers and nights off', () => {
    const plan = [
      e('2026-10-26', { recipeId: 'r-mon' }), // Monday: before today this week, not copied
      e('2026-10-27', { recipeId: 'r-tue' }),
      e('2026-10-28', { leftoversOf: 'r-tue' }),
      e('2026-10-29', { note: 'Not cooking' }),
      e('2026-10-30', { note: 'Takeout', cookId: 'm1' }),
      e('2026-10-31', { recipeId: 'r-sat' }),
      e('2026-11-07', { recipeId: 'r-planned' }), // this Saturday is already planned
      e('2026-10-27', { slot: 'lunch', id: 'l', recipeId: 'r-lunch' }),
    ]
    const out = copyWeek(plan, week, today)
    expect(out.map((o) => `${o.date}|${o.slot}|${o.recipeId ?? o.note}`)).toEqual([
      '2026-11-03|lunch|r-lunch',
      '2026-11-03|dinner|r-tue',
      '2026-11-06|dinner|Takeout',
    ])
    expect(out[2].cookId).toBe('m1')
  })
})

describe('weekly meals', () => {
  const pizza: RepeatMeal = { id: 'p', weekday: 5, slot: 'dinner', note: 'Pizza' }
  it('finds the weekly meal by weekday and fills only empty nights', () => {
    expect(repeatFor([pizza], '2026-11-06', 'dinner')?.note).toBe('Pizza')
    expect(repeatFor([pizza], '2026-11-05', 'dinner')).toBeUndefined()
    expect(repeatsInto([], [pizza], week, today)).toHaveLength(1)
    expect(repeatsInto([e('2026-11-06', { recipeId: 'x' })], [pizza], week, today)).toHaveLength(0)
    // Past Fridays are left alone.
    expect(repeatsInto([], [pizza], weekOf('2026-10-27'), today)).toHaveLength(0)
  })

  it('puts one dinner on a night when two phones set a weekly meal for it', () => {
    const curry: RepeatMeal = { id: 'c', weekday: 5, slot: 'dinner', note: 'Curry' }
    const out = repeatsInto([], [pizza, curry], week, today)
    expect(out.map((o) => o.note)).toEqual(['Pizza'])
  })
})

describe('ideas', () => {
  it('puts the most wanted first, then the newest', () => {
    const ideas: MealIdea[] = [
      { id: 'a', text: 'Tacos', at: '2026-11-01T10:00:00Z' },
      { id: 'b', text: 'Curry', at: '2026-11-02T10:00:00Z' },
      { id: 'c', text: 'Ramen', at: '2026-10-30T10:00:00Z', votes: ['m1'] },
    ]
    expect(rankIdeas(ideas).map((i) => i.id)).toEqual(['c', 'b', 'a'])
  })

  it('syncs ideas and weekly meals by id between phones', () => {
    const base = emptyDoc()
    const local = { ...emptyDoc(), ideas: [{ id: 'a', text: 'Tacos', at: 'x' }] }
    const remote = {
      ...emptyDoc(),
      repeats: [{ id: 'p', weekday: 5, slot: 'dinner' as const, note: 'Pizza' }],
    }
    const merged = mergeDocs(base, local, remote)
    expect(merged.ideas.map((i) => i.id)).toEqual(['a'])
    expect(merged.repeats.map((r) => r.id)).toEqual(['p'])
  })
})

describe('monthGrid', () => {
  it('lays out Monday-first weeks covering the month', () => {
    const g = monthGrid(2026, 10) // November 2026 starts on a Sunday
    expect(g[0][0]).toBe('2026-10-26')
    expect(g[0][6]).toBe('2026-11-01')
    expect(g.at(-1)?.at(-1)).toBe('2026-12-06')
    expect(g).toHaveLength(6)
  })
})
