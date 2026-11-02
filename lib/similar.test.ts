import { describe, expect, it } from 'vitest'
import { similarRecipes } from './similar'
import { seedRecipes } from './seed/recipes'

const byId = (id: string) => seedRecipes.find((r) => r.id === id)!

describe('similarRecipes', () => {
  it('finds close dishes and never the recipe itself', () => {
    for (const r of seedRecipes) {
      const out = similarRecipes(r, seedRecipes)
      expect(out.some((x) => x.id === r.id)).toBe(false)
      expect(out.length).toBeLessThanOrEqual(6)
    }
  })

  it('puts a dish sharing main ingredients first', () => {
    const fajitas = byId('r-chicken-fajitas')
    const out = similarRecipes(fajitas, seedRecipes)
    expect(out.length).toBeGreaterThan(0)
    const shared = (id: string) =>
      byId(id).ingredients.some((i) => fajitas.ingredients.some((j) => j.key === i.key))
    expect(shared(out[0].id)).toBe(true)
  })

  it('keeps to the same kind of cooking', () => {
    const tacos = similarRecipes(byId('r-chicken-fajitas'), seedRecipes).slice(0, 3)
    expect(tacos.some((r) => /taco|quesadilla|burrito/i.test(r.title))).toBe(true)
    const curry = similarRecipes(byId('r-cauliflower-chickpea-curry'), seedRecipes)[0]
    expect(curry.title).toMatch(/curry|dal/i)
    const pancakes = similarRecipes(byId('r-banana-oat-pancakes'), seedRecipes)
    expect(pancakes.some((r) => /carbonara|mac/i.test(r.title))).toBe(false)
  })

  it('leaves out recipes the household avoids', () => {
    const carb = byId('r-weeknight-carbonara')
    const out = similarRecipes(carb, seedRecipes, ['vegetarian'])
    expect(
      out.every(
        (r) =>
          !r.ingredients.some((i) => /bacon|pancetta|chicken|beef|pork|sausage|prawn/i.test(i.name))
      )
    ).toBe(true)
  })
})
