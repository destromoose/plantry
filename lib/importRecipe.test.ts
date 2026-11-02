import { describe, expect, it } from 'vitest'
import { extractRecipe, findUrl, isoMinutes, plainText } from './importRecipe'
import { isPrivateAddress } from './server/safeFetch'

const page = (ld: unknown, extra = '') =>
  `<html><head><meta property="og:image" content="https://img.example.com/og.jpg">${extra}
  <script type="application/ld+json">${JSON.stringify(ld)}</script></head><body></body></html>`

describe('extractRecipe', () => {
  it('reads a Recipe inside @graph with HowToSteps', () => {
    const r = extractRecipe(
      page({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebPage', name: 'x' },
          {
            '@type': ['Recipe'],
            name: 'Lemon &amp; garlic pasta',
            description: '<p>Bright and quick.</p>',
            image: [{ '@type': 'ImageObject', url: 'https://img.example.com/a.jpg' }],
            recipeYield: ['4', '4 servings'],
            prepTime: 'PT10M',
            cookTime: 'PT1H5M',
            recipeIngredient: ['200 g spaghetti', '2 cloves garlic, minced', '1 ½ tbsp olive oil'],
            recipeInstructions: [
              {
                '@type': 'HowToSection',
                name: 'Pasta',
                itemListElement: [{ '@type': 'HowToStep', text: 'Boil the pasta for 10 minutes.' }],
              },
              { '@type': 'HowToStep', text: 'Toss with garlic &amp; oil.' },
            ],
          },
        ],
      }),
      'https://www.example.com/lemon-pasta'
    )!
    expect(r.title).toBe('Lemon & garlic pasta')
    expect(r.description).toBe('Bright and quick.')
    expect(r.imageUrl).toBe('https://img.example.com/a.jpg')
    expect(r.servings).toBe(4)
    expect(r.activeMinutes).toBe(10)
    expect(r.totalMinutes).toBe(75)
    expect(r.ingredients.map((i) => i.name)).toEqual(['spaghetti', 'garlic', 'olive oil'])
    expect(r.ingredients[2].quantity).toBe(1.5)
    expect(r.steps).toEqual([
      { text: 'Boil the pasta for 10 minutes.', timerMinutes: 10 },
      { text: 'Toss with garlic & oil.' },
    ])
    expect(r.source).toBe('example.com')
  })

  it('splits one long instruction string and falls back to og:image', () => {
    const r = extractRecipe(
      page({
        '@type': 'Recipe',
        name: 'Soup',
        recipeIngredient: ['1 onion'],
        recipeInstructions: '1. Chop the onion. 2. Simmer 20 minutes.',
      }),
      'https://soup.example.org/s'
    )!
    expect(r.steps.map((s) => s.text)).toEqual(['Chop the onion.', 'Simmer 20 minutes.'])
    expect(r.imageUrl).toBe('https://img.example.com/og.jpg')
  })

  it('returns null when the page has no recipe', () => {
    expect(extractRecipe('<html><title>Hi</title></html>', 'https://a.com')).toBeNull()
    expect(extractRecipe(page({ '@type': 'Article', name: 'News' }), 'https://a.com')).toBeNull()
  })

  it('skips broken JSON-LD blocks and uses the next one', () => {
    const html =
      '<script type="application/ld+json">{broken</script>' +
      page({ '@type': 'Recipe', name: 'Toast', recipeIngredient: ['2 slices bread'] })
    expect(extractRecipe(html, 'https://a.com')?.title).toBe('Toast')
  })
})

describe('helpers', () => {
  it('reads ISO durations', () => {
    expect(isoMinutes('PT1H15M')).toBe(75)
    expect(isoMinutes('P0DT45M')).toBe(45)
    expect(isoMinutes('PT0S')).toBeUndefined()
    expect(isoMinutes('20 min')).toBeUndefined()
  })
  it('decodes entities and strips tags', () => {
    expect(plainText('Mac &amp; cheese&#39;s <b>best</b>&nbsp;one')).toBe("Mac & cheese's best one")
  })
  it('finds a link in shared text', () => {
    expect(findUrl('Try this! https://x.com/r/1?a=b.')).toBe('https://x.com/r/1?a=b')
    expect(findUrl('no link')).toBeUndefined()
  })
  it('flags private addresses', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '192.168.0.1',
      '172.20.1.1',
      '169.254.169.254',
      '::1',
      'fd00::1',
      '::ffff:127.0.0.1',
    ])
      expect(isPrivateAddress(ip)).toBe(true)
    for (const ip of ['8.8.8.8', '151.101.1.69', '2606:4700::1111'])
      expect(isPrivateAddress(ip)).toBe(false)
  })
})
