import { describe, expect, it } from 'vitest'
import { detectTimer, parseIngredientLine, parseRecipe } from './parseRecipe'

const full = `Lemon Garlic Pasta

Ingredients
200 g spaghetti
2 cloves garlic, minced
1/2 cup parmesan
1 lemon
½ tsp chili flakes
2-3 tbsp olive oil

Method
1. Boil the pasta in salted water for 10 minutes.
Drain, keep a cup of the water.
2. Fry the garlic in oil for 2-3 min.
Step 3: Toss everything together and serve.`

describe('parseRecipe', () => {
  it('reads title, ingredients and steps under headings', () => {
    const r = parseRecipe(full)
    expect(r.title).toBe('Lemon Garlic Pasta')
    expect(r.ingredients).toHaveLength(6)
    expect(r.steps).toHaveLength(3)
  })

  it('parses quantities: whole, fraction, vulgar, range', () => {
    const r = parseRecipe(full)
    const byName = Object.fromEntries(r.ingredients.map((i) => [i.name, i]))
    expect(byName['spaghetti']).toMatchObject({ quantity: 200, unit: 'g' })
    expect(byName['parmesan']).toMatchObject({ quantity: 0.5, unit: 'cup' })
    expect(byName['chili flakes']).toMatchObject({ quantity: 0.5, unit: 'tsp' })
    expect(byName['olive oil']).toMatchObject({ quantity: 2, unit: 'tbsp' })
    expect(byName['lemon']).toMatchObject({ quantity: 1, unit: '' })
  })

  it('strips trailing prep notes from names', () => {
    expect(parseIngredientLine('2 cloves garlic, minced')).toEqual({
      name: 'garlic',
      quantity: 2,
      unit: 'cloves',
    })
  })

  it('strips step markers and joins wrapped lines', () => {
    const r = parseRecipe(full)
    expect(r.steps[0].text).toBe(
      'Boil the pasta in salted water for 10 minutes. Drain, keep a cup of the water.'
    )
    expect(r.steps[2].text).toBe('Toss everything together and serve.')
  })

  it('detects timers, using the upper bound of a range', () => {
    const r = parseRecipe(full)
    expect(r.steps[0].timerMinutes).toBe(10)
    expect(r.steps[1].timerMinutes).toBe(3)
    expect(r.steps[2].timerMinutes).toBeUndefined()
    expect(detectTimer('Simmer for 12 minutes')).toBe(12)
  })

  it('handles text without headings', () => {
    const r = parseRecipe(`Quick Beans
- 1 can chickpeas
- 2 tbsp olive oil
- 1 lemon
Warm the oil in a pan over medium heat, then add the chickpeas and cook for 8 minutes until crisp at the edges.
Squeeze over the lemon and serve.`)
    expect(r.title).toBe('Quick Beans')
    expect(r.ingredients.map((i) => i.name)).toEqual(['chickpeas', 'olive oil', 'lemon'])
    expect(r.steps).toHaveLength(2)
    expect(r.steps[0].timerMinutes).toBe(8)
  })

  it('does not take a numeric first line as a title', () => {
    const r = parseRecipe(
      '2 eggs\n1 cup milk\nWhisk the eggs with the milk and cook it gently in a buttered pan until just set, about 4 minutes.'
    )
    expect(r.title).toBeUndefined()
    expect(r.ingredients).toHaveLength(2)
    expect(r.steps[0].timerMinutes).toBe(4)
  })

  it('returns empty lists for empty input', () => {
    expect(parseRecipe('  \n ')).toEqual({ ingredients: [], steps: [] })
  })
})

describe('detectTimer, more shapes', () => {
  it('reads hours, seconds and ranges', () => {
    expect(detectTimer('Roast for 1 hour 10 minutes')).toBe(70)
    expect(detectTimer('Braise 1½ hours')).toBe(90)
    expect(detectTimer('Microwave 90 seconds')).toBe(1.5)
    expect(detectTimer('Cook 10-12 mins until golden')).toBe(12)
  })
  it('ignores words that only start like a unit', () => {
    expect(detectTimer('Add 2 minced garlic cloves')).toBeUndefined()
  })
})

describe('recipe details in pasted text', () => {
  it('reads servings and times and keeps them out of the steps', () => {
    const r = parseRecipe(
      'Lemon pasta\nServes 3\nPrep time: 10 mins\nCook time: 1 hr 5 mins\n\nIngredients\n200 g spaghetti\n\nMethod\n1. Boil the pasta.'
    )
    expect(r.servings).toBe(3)
    expect(r.activeMinutes).toBe(10)
    expect(r.totalMinutes).toBe(75)
    expect(r.steps).toHaveLength(1)
    expect(r.ingredients).toHaveLength(1)
  })
})

describe('web-style ingredient lines', () => {
  it('reads long unit names and spaced fractions', () => {
    expect(parseIngredientLine('1 tablespoon lemon juice')).toEqual({
      name: 'lemon juice',
      quantity: 1,
      unit: 'tbsp',
    })
    expect(parseIngredientLine('2 Teaspoons cumin')?.unit).toBe('tsp')
    expect(parseIngredientLine('1 ½ cups rice')).toEqual({
      name: 'rice',
      quantity: 1.5,
      unit: 'cups',
    })
    expect(parseIngredientLine('500grams beef')?.unit).toBe('g')
    expect(parseIngredientLine('2 pounds potatoes')?.unit).toBe('lb')
  })
})

describe('import-style lines', () => {
  it('leaves amounts blank when there is no number, takes the low end of ranges', () => {
    expect(parseIngredientLine('Kosher salt')).toEqual({
      name: 'Kosher salt',
      quantity: 0,
      unit: '',
    })
    expect(parseIngredientLine('2 to 2 1/4 pounds chicken wings')).toEqual({
      name: 'chicken wings',
      quantity: 2,
      unit: 'lb',
    })
    expect(parseIngredientLine('1 onion finely chopped')?.name).toBe('onion')
    expect(parseIngredientLine('1 tsp kosher salt; or table salt')?.name).toBe('kosher salt')
  })
})

describe('detectTimer with several times', () => {
  it('picks the longest', () => {
    expect(detectTimer('Fry for 5 mins, then add the tomatoes and simmer for 25-30 mins.')).toBe(30)
    expect(detectTimer('Rest 10 minutes, then roast for 1 hour 15 minutes')).toBe(75)
    expect(detectTimer('Stir for 30 seconds, then cook 2 minutes')).toBe(2)
  })
})
