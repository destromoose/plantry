import { describe, expect, it } from 'vitest'
import { agoLabel, byMonth, historyFor, mostCooked, ratingsOf } from './history'
import type { CookedEntry } from './types'

const log: CookedEntry[] = [
  { recipeId: 'a', date: '2026-10-20', rating: 'loved', note: 'More lime' },
  { recipeId: 'b', date: '2026-10-12', rating: 'not-again' },
  { recipeId: 'a', date: '2026-09-30', rating: 'fine', note: 'Too salty' },
  { recipeId: 'a', date: '2026-09-02' },
]

describe('history', () => {
  it('sums up one recipe with its latest rating and note', () => {
    expect(historyFor('a', log)).toEqual({
      times: 3,
      lastDate: '2026-10-20',
      rating: 'loved',
      note: 'More lime',
    })
    expect(historyFor('z', log).times).toBe(0)
  })
  it('keeps the latest rating per recipe', () => {
    expect(ratingsOf(log)).toEqual({ a: 'loved', b: 'not-again' })
  })
  it('groups by month, newest first', () => {
    const g = byMonth(log)
    expect(g.map((m) => m.key)).toEqual(['2026-10', '2026-09'])
    expect(g[1].entries.map((e) => e.date)).toEqual(['2026-09-30', '2026-09-02'])
  })
  it('counts the most cooked', () => {
    expect(mostCooked(log, 1)).toEqual([{ recipeId: 'a', times: 3 }])
  })
  it('says when in plain words', () => {
    expect(agoLabel('2026-10-20', '2026-10-20')).toBe('today')
    expect(agoLabel('2026-10-19', '2026-10-20')).toBe('yesterday')
    expect(agoLabel('2026-10-15', '2026-10-20')).toBe('5 days ago')
    expect(agoLabel('2026-09-29', '2026-10-20')).toBe('3 weeks ago')
  })
})
