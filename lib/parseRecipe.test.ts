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
    expect(parseIngredientLine('2 cloves garlic, minced')).toEqual({ name: 'garlic', quantity: 2, unit: 'cloves' })
  })

  it('strips step markers and joins wrapped lines', () => {
    const r = parseRecipe(full)
    expect(r.steps[0].text).toBe('Boil the pasta in salted water for 10 minutes. Drain, keep a cup of the water.')
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
    const r = parseRecipe('2 eggs\n1 cup milk\nWhisk the eggs with the milk and cook it gently in a buttered pan until just set, about 4 minutes.')
    expect(r.title).toBeUndefined()
    expect(r.ingredients).toHaveLength(2)
    expect(r.steps[0].timerMinutes).toBe(4)
  })

  it('returns empty lists for empty input', () => {
    expect(parseRecipe('  \n ')).toEqual({ ingredients: [], steps: [] })
  })
})
