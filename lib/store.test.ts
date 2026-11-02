import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
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
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 2, 12) })
  s().resetAll()
})
afterAll(() => vi.useRealTimers())

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

describe('shopping list rules', () => {
  const plan = (date: string, recipeId: string, done = false) => ({
    id: `pl-${date}`,
    date,
    slot: 'dinner' as const,
    recipeId,
    done,
  })
  it('only lists what the pantry does not cover', () => {
    useStore.setState({
      recipes: [recipe('r1', [{ key: 'egg', quantity: 18 }])],
      plan: [plan('2026-11-03', 'r1')],
      pantry: [
        {
          id: 'p1',
          name: 'egg',
          key: 'egg',
          zone: 'fridge',
          aisle: 'dairy',
          quantity: 12,
          unit: 'pc',
          addedAt: '2026-11-01',
          softLifeDays: 14,
        },
      ],
    })
    s().generateShop(['2026-11-03'])
    expect(s().shop).toHaveLength(1)
    expect(s().shop[0].quantity).toBe(6)
  })
  it('skips eaten and past dinners, and keeps a removed item off', () => {
    useStore.setState({
      recipes: [recipe('r1', [{ key: 'basil' }]), recipe('r2', [{ key: 'lime' }, { key: 'mint' }])],
      plan: [plan('2026-11-01', 'r1'), plan('2026-11-03', 'r1', true), plan('2026-11-04', 'r2')],
    })
    s().generateShop(['2026-11-01', '2026-11-03', '2026-11-04'])
    expect(
      s()
        .shop.map((i) => i.key)
        .sort()
    ).toEqual(['lime', 'mint'])
    s().removeShopItem(s().shop.find((i) => i.key === 'lime')!.id)
    s().generateShop(['2026-11-04'])
    expect(s().shop.map((i) => i.key)).toEqual(['mint'])
  })
  it('merges a manual item with the same plan item', () => {
    useStore.setState({
      recipes: [recipe('r1', [{ key: 'lime', quantity: 2 }])],
      plan: [plan('2026-11-03', 'r1')],
    })
    s().addShopItem('Limes')
    s().generateShop(['2026-11-03'])
    expect(s().shop.filter((i) => i.key === 'lime')).toHaveLength(1)
  })
  it('does not wipe a list when nothing is planned', () => {
    useStore.setState({
      recipes: [recipe('r1', [{ key: 'lime' }])],
      plan: [plan('2026-11-03', 'r1')],
    })
    s().generateShop(['2026-11-03'])
    useStore.setState({ plan: [] })
    expect(s().generateShop(['2026-11-03']).kept).toBe(true)
    expect(s().shop).toHaveLength(1)
  })
  it('drops unbought items for a dinner once it is cooked', () => {
    useStore.setState({
      recipes: [recipe('r1', [{ key: 'lime' }])],
      plan: [plan('2026-11-03', 'r1')],
    })
    s().generateShop(['2026-11-03'])
    s().markCooked('2026-11-03')
    expect(s().shop).toHaveLength(0)
  })
})

describe('week and leftovers', () => {
  it('removes a leftovers night when its cook night is removed', () => {
    useStore.setState({
      recipes: [recipe('r1', [{ key: 'lime' }], true)],
      plan: [
        { id: 'a', date: '2026-11-03', slot: 'dinner', recipeId: 'r1' },
        { id: 'b', date: '2026-11-04', slot: 'dinner', leftoversOf: 'r1' },
      ],
    })
    s().clearPlanEntry('2026-11-03', 'dinner')
    expect(s().plan).toHaveLength(0)
  })
  it('can swap a planned tomorrow for leftovers', () => {
    useStore.setState({
      recipes: [recipe('r1', [{ key: 'lime' }], true), recipe('r2', [{ key: 'mint' }])],
      plan: [
        { id: 'a', date: '2026-11-03', slot: 'dinner', recipeId: 'r1' },
        { id: 'b', date: '2026-11-04', slot: 'dinner', recipeId: 'r2' },
      ],
    })
    s().markCooked('2026-11-03', { leftovers: true, replaceTomorrow: true })
    expect(s().plan.find((p) => p.date === '2026-11-04')?.leftoversOf).toBe('r1')
  })
})
