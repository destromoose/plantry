import { describe, expect, it } from 'vitest'
import { CAPTURE_KEY, bookmarkletCode, readCapture } from './pageCapture'

const hashOf = (d: unknown) => `#${CAPTURE_KEY}=${encodeURIComponent(JSON.stringify(d))}`
const ld = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Recipe',
  name: 'Basic lasagna',
  recipeIngredient: ['1 lb ground beef', '2 cups ricotta'],
  recipeInstructions: [{ '@type': 'HowToStep', text: 'Bake for 45 minutes.' }],
})

describe('Save to Plantry bookmark', () => {
  it('is a javascript: link that parses', () => {
    const code = bookmarkletCode('https://plantry.example')
    expect(code.startsWith('javascript:')).toBe(true)
    expect(() => new Function(code.slice('javascript:'.length))).not.toThrow()
    expect(code).toContain('https://plantry.example/recipes/new#page=')
  })

  it('reads a recipe block handed over in the hash', () => {
    const r = readCapture(
      hashOf({ u: 'https://www.allrecipes.com/recipe/1/x', ld: [ld], im: 'https://img/x.jpg' })
    )
    expect(r?.title).toBe('Basic lasagna')
    expect(r?.ingredients).toHaveLength(2)
    expect(r?.steps[0].timerMinutes).toBe(45)
    expect(r?.source).toBe('allrecipes.com')
    expect(r?.sourceUrl).toBe('https://www.allrecipes.com/recipe/1/x')
  })

  it('falls back to the page text', () => {
    const r = readCapture(
      hashOf({
        u: 'https://blog.example/soup',
        tx: 'Ingredients\n2 carrots\n1 onion\nMethod\n1. Simmer for 20 minutes.',
      })
    )
    expect(r?.ingredients.length).toBe(2)
    expect(r?.source).toBe('blog.example')
  })

  it('uses the page text when the recipe block is unreadable', () => {
    const r = readCapture(
      hashOf({
        u: 'https://blog.example/soup',
        ld: ['{"@type":"Recipe","name":"x"'],
        tx: 'Soup\nIngredients\n2 carrots\nMethod\n1. Simmer.',
      })
    )
    expect(r?.ingredients.length).toBe(1)
  })

  it('sends only real Recipe blocks, and the page text too', () => {
    const code = bookmarkletCode('https://plantry.example')
    expect(code).toContain(String.raw`/"@type"\s*:\s*(\[[^\]]*)?"Recipe"/`)
    expect(code).toMatch(/d\.tx=/)
    expect(code).not.toMatch(/else d\.tx/)
  })

  it('ignores anything else', () => {
    expect(readCapture('#other')).toBeNull()
    expect(readCapture(`#${CAPTURE_KEY}=%7Bbroken`)).toBeNull()
    expect(readCapture(hashOf({ u: 'javascript:alert(1)', ld: [ld] }))).toBeNull()
    expect(readCapture(hashOf({ u: 'https://a.example', tx: 'nothing here' }))).toBeNull()
  })
})
