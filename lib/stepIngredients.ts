// Which ingredients a cooking step talks about, so cook mode can show
// "1 tbsp olive oil, 1 onion" right under the step instead of sending you
// back to the full list.

import type { Ingredient } from './types'

const VAGUE = new Set([
  'fresh',
  'large',
  'small',
  'medium',
  'red',
  'green',
  'yellow',
  'white',
  'black',
  'extra',
  'virgin',
  'ground',
  'dried',
  'chopped',
  'sliced',
  'minced',
  'whole',
  'baby',
  'sweet',
  'hot',
  'cold',
  'light',
  'dark',
  'plain',
  'free',
  'range',
  'boneless',
  'skinless',
  'can',
  'tin',
  'canned',
  'frozen',
  'grande',
  'fresco',
  'fresca',
  'de',
  'del',
  'la',
  'el',
])

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function wordsFor(ing: Ingredient): string[] {
  const name = ing.name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .trim()
  const parts = name.split(/[\s,/-]+/).filter((w) => w.length >= 3 && !VAGUE.has(w))
  const out = new Set<string>([name])
  if (ing.key) out.add(ing.key.toLowerCase())
  // "red onion" is "the onion" in a step; "chicken thighs" may be "the chicken".
  const last = parts[parts.length - 1]
  if (last && last.length >= 3) out.add(last)
  if (parts.length >= 2 && parts[0].length >= 4) out.add(parts[0])
  return [...out].filter(Boolean)
}

const cache = new WeakMap<Ingredient, RegExp>()
function matcher(ing: Ingredient): RegExp {
  let re = cache.get(ing)
  if (!re) {
    const alts = wordsFor(ing)
      .sort((a, b) => b.length - a.length)
      .map((w) => `${escape(w.replace(/(?:es|s)$/, ''))}(?:es|s)?`)
    re = new RegExp(`(?<!\\p{L})(?:${alts.join('|')})(?!\\p{L})`, 'iu')
    cache.set(ing, re)
  }
  return re
}

/** The recipe's ingredients that appear in this step, in recipe order. */
export function ingredientsInStep(text: string, ingredients: Ingredient[]): Ingredient[] {
  if (!text) return []
  return ingredients.filter((i) => i.name.trim() && matcher(i).test(text))
}
