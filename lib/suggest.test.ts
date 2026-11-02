import { describe, expect, it } from 'vitest'
import { coverage, pickNext, suggest } from './suggest'
import type { Aisle, PantryItem, Recipe } from './types'

function recipe(
  id: string,
  keys: string[],
  opts: Partial<Recipe> = {},
  optional: string[] = []
): Recipe {
  const ing = (k: string, o: boolean) => ({
    id: `${id}-${k}`,
    name: k,
    key: k,
    quantity: 1,
    unit: '',
    aisle: 'produce' as Aisle,
    optional: o || undefined,
  })
  return {
    id,
    title: id,
    description: '',
    activeMinutes: 20,
    totalMinutes: 30,
    servings: 2,
    ingredients: [...keys.map((k) => ing(k, false)), ...optional.map((k) => ing(k, true))],
    steps: [],
    tastes: [],
    isFavorite: false,
    createdAt: '2026-01-01',
    ...opts,
  }
}

function item(key: string): PantryItem {
  return {
    id: `p-${key}`,
    name: key,
    key,
    zone: 'fridge',
    aisle: 'produce',
    addedAt: '2026-11-03T00:00:00.000Z',
    softLifeDays: 30,
  }
}

const context = { weatherLean: 'any' as const, isWeekend: false, now: '2026-11-03T12:00:00.000Z' }
const base = { tastes: [], context }

describe('coverage', () => {
  it('counts non-optional ingredients only', () => {
    const r = recipe('a', ['egg', 'rice', 'lime'], {}, ['chili'])
    const c = coverage(r, [item('egg')])
    expect(c.total).toBe(3)
    expect(c.have).toBe(1)
    expect(c.missing).toEqual(['rice', 'lime'])
  })
})

describe('suggest', () => {
  it('ranks a fully covered recipe above an uncovered one', () => {
    const covered = recipe('covered', ['egg', 'rice'])
    const bare = recipe('bare', ['truffle', 'saffron'])
    const out = suggest({ ...base, recipes: [bare, covered], pantry: [item('egg'), item('rice')] })
    expect(out[0].recipe.id).toBe('covered')
  })

  it('puts quick recipes first when energy is cant-tonight', () => {
    const quick = recipe('quick', ['egg'], { activeMinutes: 8, totalMinutes: 10 })
    const slow = recipe('slow', ['egg'], { activeMinutes: 40, totalMinutes: 40 })
    const out = suggest({
      ...base,
      recipes: [slow, quick],
      pantry: [item('egg')],
      energy: 'cant-tonight',
    })
    expect(out.map((s) => s.recipe.id)).toEqual(['quick', 'slow'])
  })

  it('penalizes recently cooked recipes', () => {
    const a = recipe('a', ['egg'])
    const b = recipe('b', ['egg'])
    const out = suggest({ ...base, recipes: [a, b], pantry: [item('egg')], recent: ['a'] })
    expect(out[0].recipe.id).toBe('b')
  })
})

describe('pickNext', () => {
  it('never returns a seen id while fresh options remain', () => {
    const recipes = ['a', 'b', 'c', 'd'].map((id) => recipe(id, ['egg']))
    const ranked = suggest({ ...base, recipes, pantry: [item('egg')] })
    for (let i = 0; i < 50; i++) {
      const pick = pickNext(ranked, ['a', 'b'])
      expect(['c', 'd']).toContain(pick?.recipe.id)
    }
  })
})

describe('ratings', () => {
  it('rarely suggests a dinner rated "not again"', async () => {
    const { suggest } = await import('./suggest')
    const { seedRecipes } = await import('./seed/recipes')
    const ctx = { weatherLean: 'any' as const, isWeekend: false, now: new Date().toISOString() }
    const base = suggest({ recipes: seedRecipes, pantry: [], tastes: [], context: ctx })
    const top = base[0].recipe.id
    const rated = suggest({
      recipes: seedRecipes,
      pantry: [],
      tastes: [],
      context: ctx,
      ratings: { [top]: 'not-again' },
    })
    expect(rated[0].recipe.id).not.toBe(top)
    expect(rated.findIndex((s) => s.recipe.id === top)).toBeGreaterThan(5)
  })
})
