import { describe, expect, it } from 'vitest'
import { seedRecipes } from './recipes'
import { seedEs } from './recipes.es'
import { canonicalRecipes, localizeRecipes } from './localize'
import { keyOf } from '@/lib/utils'
import { cautionsFor } from '@/lib/safety'

describe('Spanish seed recipes', () => {
  it('has every recipe with the same number of ingredients and steps', () => {
    for (const r of seedRecipes) {
      const es = seedEs[r.id]
      expect(es, r.id).toBeDefined()
      expect(es.ingredients.length, r.id).toBe(r.ingredients.length)
      expect(es.steps.length, r.id).toBe(r.steps.length)
    }
  })

  it('swaps the text and back without touching anything else', () => {
    const fav = { ...seedRecipes[0], isFavorite: false }
    const es = localizeRecipes([fav], 'es')[0]
    expect(es.title).toBe(seedEs[fav.id].title)
    expect(es.ingredients.map((i) => i.key)).toEqual(fav.ingredients.map((i) => i.key))
    expect(es.isFavorite).toBe(false)
    expect(canonicalRecipes([es])[0]).toEqual(fav)
  })

  it('leaves your own recipes alone', () => {
    const own = { ...seedRecipes[0], id: 'mine', source: undefined }
    expect(localizeRecipes([own], 'es')[0]).toEqual(own)
  })

  it('Spanish ingredient names match the recipe keys', () => {
    for (const r of seedRecipes)
      seedEs[r.id].ingredients.forEach((name, i) => {
        const key = r.ingredients[i].key
        expect(keyOf(name), `${r.id}: ${name}`).toBe(key)
      })
  })

  it('finds safety notes in Spanish steps', () => {
    expect(cautionsFor('Calienta el horno a 220C.').map((c) => c.kind)).toContain('oven')
    expect(cautionsFor('Pica fino la cebolla.').map((c) => c.kind)).toContain('sharp')
    expect(cautionsFor('Dora el pollo en la sartén.').map((c) => c.kind)).toContain('hot')
    expect(cautionsFor('Lleva el agua a hervor y cuece la pasta.').map((c) => c.kind)).toContain(
      'boil'
    )
  })
})
