import { describe, expect, it } from 'vitest'
import { buildFeed, calendarToken } from './calendarFeed'
import type { Recipe } from './types'

const tacos = {
  id: 'tacos',
  title: 'Chicken tacos, quick',
  ingredients: [
    { id: 'a', name: 'Chicken thighs', key: 'chicken', quantity: 1, unit: '', aisle: 'meat-fish' },
  ],
} as Pick<Recipe, 'id' | 'title' | 'ingredients'>
const dal = { id: 'dal', title: 'Red lentil dal', ingredients: [] } as unknown as Recipe

const input = {
  members: [{ id: 'm1', name: 'Sam' }],
  recipes: [tacos, dal],
  plan: [
    { id: 'p1', date: '2026-11-04', slot: 'dinner' as const, recipeId: 'tacos', cookId: 'm1' },
    { id: 'p2', date: '2026-11-05', slot: 'dinner' as const, recipeId: 'dal' },
    { id: 'p3', date: '2026-11-06', slot: 'dinner' as const, note: 'Takeout' },
    { id: 'p4', date: '2026-08-01', slot: 'dinner' as const, recipeId: 'dal' },
  ],
}
const opts = { today: '2026-11-03', origin: 'https://example.com', stamp: '20261103T000000Z' }

describe('buildFeed', () => {
  const ics = buildFeed(input, opts)

  it('is a calendar with one all-day event per planned meal in range', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics).toContain('DTSTART;VALUE=DATE:20261104')
    expect(ics).toContain('DTEND;VALUE=DATE:20261105')
    expect(ics).toContain('SUMMARY:Takeout')
    expect(ics).not.toContain('20260801')
  })

  it('says who cooks and escapes commas', () => {
    expect(ics).toContain('SUMMARY:Chicken tacos\\, quick · Sam cooks')
    expect(ics).toContain('URL:https://example.com/recipes/tacos')
  })

  it('adds a morning reminder only when something needs thawing', () => {
    expect(ics).toContain('DTSTART:20261104T080000')
    expect(ics).toContain('SUMMARY:Take the chicken thighs out of the freezer')
    expect(ics.match(/T080000/g)).toHaveLength(1)
  })

  it('keeps every line short enough for calendar apps', () => {
    const long = buildFeed({ ...input, plan: [{ ...input.plan[2], note: 'x'.repeat(110) }] }, opts)
    for (const line of long.split('\r\n')) expect(line.length).toBeLessThanOrEqual(75)
  })

  it('speaks Spanish', () => {
    expect(buildFeed(input, { ...opts, lang: 'es' })).toContain('cocina Sam')
  })
})

describe('calendarToken', () => {
  it('is stable, hex, and not the code', async () => {
    const a = await calendarToken('ABCDEFGHJKMN')
    expect(a).toMatch(/^[0-9a-f]{24}$/)
    expect(await calendarToken('ABCDEFGHJKMN')).toBe(a)
    expect(await calendarToken('ABCDEFGHJKMP')).not.toBe(a)
  })
})
