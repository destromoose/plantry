import { describe, expect, it } from 'vitest'
import { ingredientsInStep } from './stepIngredients'
import type { Ingredient } from './types'

const ing = (name: string, key = name.toLowerCase()): Ingredient => ({
  id: name,
  name,
  key,
  quantity: 1,
  unit: '',
  aisle: 'other',
})

describe('ingredientsInStep', () => {
  const list = [
    ing('Olive oil', 'olive oil'),
    ing('Red onion', 'onion'),
    ing('Garlic'),
    ing('Chicken thighs', 'chicken thigh'),
    ing('Tomatoes', 'tomato'),
    ing('Salt'),
  ]
  it('finds names, last words, plurals and keys', () => {
    const names = (s: string) => ingredientsInStep(s, list).map((i) => i.name)
    expect(names('Heat the olive oil and soften the onions.')).toEqual(['Olive oil', 'Red onion'])
    expect(names('Brown the chicken, then add the garlic and a tomato.')).toEqual([
      'Garlic',
      'Chicken thighs',
      'Tomatoes',
    ])
  })
  it('matches whole words only', () => {
    expect(ingredientsInStep('Bring to a boil. Season with salty water.', list)).toEqual([])
  })
})
