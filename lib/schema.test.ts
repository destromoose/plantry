import { describe, expect, it } from 'vitest'
import { checkImport, cleanData } from './schema'

const recipe = {
  id: 'r1',
  title: 'Dal',
  description: '',
  activeMinutes: 10,
  totalMinutes: 30,
  servings: 2,
  ingredients: [
    { id: 'i1', name: 'lentils', key: 'lentils', quantity: 200, unit: 'g', aisle: 'pantry' },
  ],
  steps: [{ id: 's1', text: 'Cook.' }],
  tastes: [],
  isFavorite: false,
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('cleanData', () => {
  it('keeps good items and drops broken ones', () => {
    const { data, dropped, badCollections } = cleanData({
      recipes: [recipe, { id: 5 }],
      pantry: 'nope',
    })
    expect(data.recipes?.map((r) => r.id)).toEqual(['r1'])
    expect(dropped).toBe(1)
    expect(data.pantry).toBeUndefined()
    expect(badCollections).toEqual(['pantry'])
  })
  it('survives null and junk', () => {
    expect(cleanData(null).data).toEqual({})
    expect(cleanData(42).badCollections).toEqual(['all'])
  })
})

describe('checkImport', () => {
  it('rejects files that are not exports', () => {
    expect(checkImport({ hello: 1 }).ok).toBe(false)
    expect(checkImport([]).ok).toBe(false)
  })
  it('rejects a broken section instead of half-importing', () => {
    expect(checkImport({ recipes: [recipe], pantry: 'broken' }).ok).toBe(false)
  })
  it('accepts a good export and marks onboarding done', () => {
    const res = checkImport({ recipes: [recipe] })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.data.settings.onboarded).toBe(true)
  })
})
