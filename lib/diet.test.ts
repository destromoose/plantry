import { describe, expect, it } from 'vitest'
import { conflicts, householdAvoid, ingredientTags, isSafe } from './diet'
import { seedRecipes } from './seed/recipes'
import { suggest } from './suggest'

const byTitle = (t: string) => seedRecipes.find((r) => r.title === t)!
const ing = (name: string) => ({ name, key: name })

describe('ingredient tags', () => {
  it('spots common allergens', () => {
    expect(ingredientTags(ing('Peanut butter')).has('peanut')).toBe(true)
    expect(ingredientTags(ing('Peanut butter')).has('dairy')).toBe(false)
    expect(ingredientTags(ing('Cashews')).has('tree-nut')).toBe(true)
    expect(ingredientTags(ing('Coconut milk')).has('dairy')).toBe(false)
    expect(ingredientTags(ing('Feta')).has('dairy')).toBe(true)
    expect(ingredientTags(ing('Soy sauce')).has('gluten')).toBe(true)
    expect(ingredientTags(ing('Scallions')).has('shellfish')).toBe(false)
    expect(ingredientTags(ing('Eggplant')).has('egg')).toBe(false)
    expect(ingredientTags(ing('Nutmeg')).has('tree-nut')).toBe(false)
  })
})

describe('conflicts', () => {
  it('flags the peanut noodles for a peanut allergy', () => {
    const r = byTitle('Peanut chicken noodles')
    expect(isSafe(r, ['peanut'])).toBe(false)
    expect(r.tastes).not.toContain('kid-friendly')
  })
  it('handles diets', () => {
    expect(isSafe(byTitle('Ginger pork stir-fry'), ['no-pork'])).toBe(false)
    expect(isSafe(byTitle('Ginger pork stir-fry'), ['vegetarian'])).toBe(false)
    expect(isSafe(byTitle('Red lentil dal with rice'), ['vegan'])).toBe(true)
    expect(isSafe(byTitle('Shakshuka with feta'), ['vegan'])).toBe(false)
  })
  it('suggests leaving out an optional ingredient instead of blocking', () => {
    const c = conflicts(
      {
        ingredients: [
          {
            id: 'a',
            name: 'Feta',
            key: 'feta',
            quantity: 1,
            unit: '',
            aisle: 'dairy',
            optional: true,
          },
        ],
      },
      ['dairy']
    )
    expect(c.blocking).toEqual([])
    expect(c.leaveOut).toEqual(['Feta'])
  })
  it('combines the household list with each person', () => {
    expect(
      householdAvoid({ avoid: ['dairy'] }, [
        { id: '1', name: 'A', color: 'sage', avoid: ['peanut'] },
        { id: '2', name: 'B', color: 'plum', diet: 'vegetarian' },
      ]).sort()
    ).toEqual(['dairy', 'peanut', 'vegetarian'])
  })
})

describe('suggest', () => {
  it('never suggests a recipe that breaks a rule', () => {
    const out = suggest({
      recipes: seedRecipes,
      pantry: [],
      tastes: [],
      context: { weatherLean: 'any', isWeekend: false, now: new Date().toISOString() },
      avoid: ['peanut', 'vegetarian'],
    })
    expect(out.length).toBeGreaterThan(0)
    expect(out.every((s) => isSafe(s.recipe, ['peanut', 'vegetarian']))).toBe(true)
    expect(out.some((s) => /chicken|beef|pork|salmon|prawn/i.test(s.recipe.title))).toBe(false)
  })
})
