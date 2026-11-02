import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from './store'
import type { Aisle, Recipe } from './types'

function recipe(
  id: string,
  ings: { key: string; quantity?: number; aisle?: Aisle }[],
  leftovers = false
): Recipe {
  return {
    id,
    title: id,
    description: '',
    activeMinutes: 20,
    totalMinutes: 30,
    servings: 2,
    leftovers,
    ingredients: ings.map((i) => ({
      id: `${id}-${i.key}`,
      name: i.key,
      key: i.key,
      quantity: i.quantity ?? 1,
      unit: 'pc',
      aisle: i.aisle ?? 'produce',
    })),
    steps: [],
    tastes: [],
    isFavorite: false,
    createdAt: '2026-01-01',
  }
}

const s = () => useStore.getState()

beforeEach(() => {
  s().resetAll()
})

describe('completeOnboarding', () => {
  it('creates members with colors and pantry items', () => {
    s().completeOnboarding({
      members: [{ name: 'Ana' }, { name: 'Ben' }],
      tastes: ['cozy'],
      pantryNames: ['Olive oil', 'Eggs'],
    })
    expect(s().members).toHaveLength(2)
    expect(s().members.every((m) => !!m.color)).toBe(true)
    expect(s().members[0].isMe).toBe(true)
    expect(
      s()
        .pantry.map((p) => p.key)
        .sort()
    ).toEqual(['egg', 'olive oil'])
    expect(s().settings.onboarded).toBe(true)
  })
})

describe('generateShop', () => {
  it('excludes pantry-covered ingredients and merges duplicates across recipes', () => {
    useStore.setState({
      recipes: [
        recipe('r1', [{ key: 'tomato', quantity: 2 }, { key: 'basil' }]),
        recipe('r2', [
          { key: 'tomato', quantity: 3 },
          { key: 'rice', aisle: 'pantry' },
        ]),
      ],
      plan: [
        { id: 'a', date: '2026-11-03', slot: 'dinner', recipeId: 'r1' },
        { id: 'b', date: '2026-11-04', slot: 'dinner', recipeId: 'r2' },
      ],
    })
    s().addPantryItem({ name: 'Rice' })
    s().generateShop(['2026-11-03', '2026-11-04'])
    const keys = s()
      .shop.map((i) => i.key)
      .sort()
    expect(keys).toEqual(['basil', 'tomato'])
    const tomato = s().shop.find((i) => i.key === 'tomato')!
    expect(tomato.quantity).toBe(5)
    expect(tomato.fromRecipeIds.sort()).toEqual(['r1', 'r2'])
  })
})

describe('finishShopping', () => {
  it('moves checked items into the pantry', () => {
    s().addShopItem('Lime')
    s().addShopItem('Mango')
    const lime = s().shop.find((i) => i.key === 'lime')!
    s().toggleShopItem(lime.id)
    s().finishShopping()
    expect(s().pantry.some((p) => p.key === 'lime')).toBe(true)
    expect(s().shop.map((i) => i.key)).toEqual(['mango'])
  })
})

describe('markCooked', () => {
  it('creates a leftovers entry for the next day', () => {
    useStore.setState({
      recipes: [recipe('stew', [{ key: 'beef', aisle: 'meat-fish' }], true)],
      plan: [{ id: 'a', date: '2026-11-03', slot: 'dinner', recipeId: 'stew' }],
    })
    s().markCooked('2026-11-03', { leftovers: true })
    const next = s().plan.find((p) => p.date === '2026-11-04' && p.slot === 'dinner')
    expect(next?.leftoversOf).toBe('stew')
    expect(s().plan.find((p) => p.id === 'a')?.done).toBe(true)
    expect(s().cooked[0].recipeId).toBe('stew')
  })
})

describe('importData', () => {
  it('rejects garbage', () => {
    expect(s().importData('not json').ok).toBe(false)
    expect(s().importData('{"hello":1}').ok).toBe(false)
    expect(s().importData('null').ok).toBe(false)
  })

  it('round-trips an export', () => {
    s().addShopItem('Lime')
    const json = s().exportData()
    s().resetAll()
    expect(s().importData(json).ok).toBe(true)
    expect(s().shop).toHaveLength(1)
  })
})

describe('double taps', () => {
  it('logs a dinner once even if Finish is tapped twice', () => {
    useStore.setState({
      recipes: [recipe('r1', [{ key: 'tomato' }])],
      plan: [{ id: 'a', date: '2026-11-03', slot: 'dinner', recipeId: 'r1' }],
      cooked: [],
    })
    s().markCooked('2026-11-03')
    s().markCooked('2026-11-03')
    expect(s().cooked).toHaveLength(1)
  })
  it('says when an item is already on the list', () => {
    expect(s().addShopItem('Lime')).toBe('added')
    expect(s().addShopItem('limes')).toBe('exists')
  })
})
