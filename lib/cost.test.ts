import { describe, expect, it } from 'vitest'
import { formatMoney, guessCurrency, recipeCost, shopCost } from './cost'
import { nutritionOf, isReliable } from './nutrition'
import { gramsOf, factsTable } from './ingredientFacts'
import { seedRecipes } from './seed/recipes'

const usd = { currency: 'USD' as const, priceLevel: 'average' as const }

describe('ingredient facts', () => {
  it('knows every seed ingredient', () => {
    const missing = seedRecipes
      .flatMap((r) => r.ingredients)
      .filter((i) => !factsTable[i.key])
      .map((i) => i.key)
    expect(missing).toEqual([])
  })
  it('weighs spoons, counts and grams', () => {
    expect(gramsOf(2, 'tbsp', factsTable['olive oil'])).toBeCloseTo(27)
    expect(gramsOf(3, 'clove', factsTable.garlic)).toBe(15)
    expect(gramsOf(1, 'kg', factsTable.rice)).toBe(1000)
    expect(gramsOf(1, 'bunch', factsTable.parsley)).toBe(50)
  })
})

describe('nutrition', () => {
  it('counts every seed recipe in a believable range', () => {
    for (const r of seedRecipes) {
      const n = nutritionOf(r)
      expect(isReliable(n)).toBe(true)
      expect(n.kcal).toBeGreaterThan(200)
      expect(n.kcal).toBeLessThan(1100)
    }
  })
})

describe('cost', () => {
  it('prices a dinner and scales with servings', () => {
    const r = seedRecipes[0]
    const four = recipeCost(r, 4, usd)
    const eight = recipeCost(r, 8, usd)
    expect(four.total).toBeGreaterThan(2)
    expect(eight.total).toBeCloseTo(four.total * 2)
    expect(four.perServing).toBeCloseTo(eight.perServing)
  })
  it('only counts what you still need to buy', () => {
    const r = seedRecipes[0]
    const all = recipeCost(r, 4, usd)
    const some = recipeCost(r, 4, usd, [{ key: 'feta' }, { key: 'chickpea' }])
    expect(some.toBuy).toBeLessThan(all.toBuy)
    expect(some.total).toBeCloseTo(all.total)
  })
  it('adds up the unticked list', () => {
    const res = shopCost(
      [
        {
          id: '1',
          name: 'Rice',
          key: 'rice',
          quantity: 500,
          unit: 'g',
          aisle: 'pantry',
          checked: false,
          fromRecipeIds: [],
        },
        {
          id: '2',
          name: 'Mystery',
          key: 'mystery',
          aisle: 'other',
          checked: false,
          fromRecipeIds: [],
        },
        {
          id: '3',
          name: 'Feta',
          key: 'feta',
          quantity: 200,
          unit: 'g',
          aisle: 'dairy',
          checked: true,
          fromRecipeIds: [],
        },
      ],
      usd
    )
    expect(res.total).toBeCloseTo(1.5)
    expect(res.unknown).toBe(1)
  })
  it('formats money and guesses a currency', () => {
    expect(formatMoney(3.5, 'USD', 'en-US')).toBe('$3.50')
    expect(formatMoney(54.2, 'EUR', 'en-US')).toBe('€54')
    expect(guessCurrency('MX')).toBe('MXN')
    expect(guessCurrency('ES')).toBe('EUR')
  })
})

describe('imported ingredient names', () => {
  it('finds facts for everyday UK and US names', async () => {
    const { factsFor, isTrace } = await import('./ingredientFacts')
    const { keyOf } = await import('./utils')
    const has = (name: string) => !!factsFor({ key: keyOf(name), name })
    for (const n of [
      'sunflower oil',
      'garlic cloves',
      'can chopped tomatoes',
      'skinless and boneless chicken thighs',
      'fat-free Greek yogurt',
      'ground almonds',
      'basmati rice',
      'double cream',
      'large free-range eggs',
      'spaghetti',
      'plain flour',
    ])
      expect(has(n), n).toBe(true)
    // A distinctive first word must not be dropped to reach a generic food.
    for (const n of [
      'almond milk',
      'oat milk',
      'cream cheese',
      'cottage cheese',
      'almond butter',
      'ice cream',
      'coconut cream',
    ])
      expect(factsFor({ key: keyOf(n), name: n }) === factsFor({ key: 'milk' }), n).toBe(false)
    expect(factsFor({ key: keyOf('cream cheese'), name: 'cream cheese' })).toBeUndefined()
    expect(factsFor({ key: keyOf('feta cheese'), name: 'feta cheese' })).toBe(
      factsFor({ key: 'feta' })
    )
    expect(isTrace('garam masala')).toBe(true)
    expect(isTrace('1 tsp ground turmeric'.replace(/^\S+ \S+ /, ''))).toBe(true)
    expect(isTrace('chicken')).toBe(false)
  })
})
