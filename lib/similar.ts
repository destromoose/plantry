import type { Recipe } from './types'
import { isSafe } from './diet'
import { isTrace } from './ingredientFacts'
import { staples } from './seed/pantry'

const stapleKeys = new Set(staples.map((s) => s.key))

/** The ingredients that give a dish its character: not salt, oil, spices or other staples. */
function mainKeys(r: Recipe): Set<string> {
  return new Set(
    r.ingredients
      .filter((i) => !i.optional && !stapleKeys.has(i.key) && !isTrace(i.name))
      .map((i) => i.key)
  )
}

/**
 * Kitchens a dish leans toward, guessed from its title and ingredients. Whole words
 * only, so olive oil, chili flakes and goat cheese don't count as olives, chili or oats.
 * Breakfast and soup are read from the title, in English or Spanish, since oat milk or
 * chili flakes can go in anything.
 */
const families: [string, RegExp, 'all' | 'title'][] = [
  [
    'east-asian',
    /\b(soy sauce|ginger|sesame|noodles?|fried rice|stir-fry|teriyaki|hoisin|miso|bok choy)\b/i,
    'all',
  ],
  ['southeast-asian', /\b(coconut milk|fish sauce|lemongrass|thai|curry paste|peanuts?)\b/i, 'all'],
  [
    'south-asian',
    /\b(garam masala|curry powder|turmeric|lentils?|dal|naan|paneer|chickpea curry|cauliflower curry|tikka|korma|biryani)\b/i,
    'all',
  ],
  [
    'latin',
    /\b(tortillas?|tacos?|fajitas?|burritos?|black beans?|chipotle|quesadillas?|salsa|enchiladas?)\b/i,
    'all',
  ],
  [
    'italian',
    /\b(pasta|spaghetti|penne|parmesan|risotto|mozzarella|gnocchi|carbonara|ragu)\b/i,
    'all',
  ],
  [
    'mediterranean',
    /\b(feta|couscous|tzatziki|chickpeas?|shakshuka|olives|halloumi|za.?atar)\b/i,
    'all',
  ],
  [
    'breakfast',
    /\b(pancakes?|oats?|oatmeal|porridge|granola|waffles?|french toast|tortitas?|panqueques?|avena|gachas|gofres?|torrijas?)\b/i,
    'title',
  ],
  [
    'soup',
    /\b(soup|stew|chili|dal|sopa|guiso|estofado|caldo)\b(?!\s+(garlic|flakes?|oil|crisp))/i,
    'title',
  ],
]

function familiesOf(r: Recipe): Set<string> {
  const all = [r.title, ...r.ingredients.flatMap((i) => [i.name, i.key])].join(' · ')
  return new Set(
    families.filter(([, re, where]) => re.test(where === 'title' ? r.title : all)).map(([f]) => f)
  )
}

/** The shape of a dish, from its title: tacos sit with tacos, soups with soups. */
const forms: [string, RegExp][] = [
  ['wrap', /\b(tacos?|fajitas?|burritos?|quesadillas?|wraps?|enchiladas?)\b/i],
  ['curry', /\b(curry|curri|dal)\b/i],
  ['noodles', /\b(noodles?|fideos?|ramen|udon)\b/i],
  ['pasta', /\b(pasta|spaghetti|espaguetis?|penne|ragu|ragú|carbonara|macaroni|mac)\b/i],
  ['soup', /\b(soup|sopa|stew|guiso|chili)\b(?!\s+(garlic|flakes?|oil|crisp))/i],
  ['bowl', /\b(bowls?|bol|boles|cuencos?)\b/i],
  ['tray', /\b(tray ?bake|sheet-pan|traybake|bandeja)\b/i],
]

function formsOf(r: Recipe): Set<string> {
  const out = new Set(forms.filter(([, re]) => re.test(r.title)).map(([f]) => f))
  // Anything folded into a tortilla eats like a taco, whatever it's called.
  if (r.ingredients.some((i) => i.key === 'tortilla')) out.add('wrap')
  return out
}

/**
 * Recipes close to this one: the same tastes, the same main ingredients, and a
 * similar amount of work. Recipes the household can't eat are left out.
 */
export function similarRecipes(recipe: Recipe, all: Recipe[], avoid: string[] = [], n = 6) {
  // Rare ingredients say more than common ones: sharing coconut milk means more
  // than sharing eggs.
  const keysOf = new Map(all.map((r) => [r.id, mainKeys(r)]))
  const df = new Map<string, number>()
  for (const keys of keysOf.values()) for (const k of keys) df.set(k, (df.get(k) ?? 0) + 1)
  const weight = (k: string) => Math.log((all.length + 1) / (df.get(k) ?? 1))
  const mine = keysOf.get(recipe.id) ?? mainKeys(recipe)
  const tastes = new Set(recipe.tastes)
  const kin = familiesOf(recipe)
  const shape = formsOf(recipe)
  return all
    .filter((r) => r.id !== recipe.id && isSafe(r, avoid))
    .map((r) => {
      let score = 0
      for (const k of keysOf.get(r.id) ?? []) if (mine.has(k)) score += weight(k)
      for (const x of r.tastes) if (tastes.has(x)) score += 0.75
      const theirs = familiesOf(r)
      for (const f of theirs) if (kin.has(f)) score += 2.5
      for (const f of formsOf(r)) if (shape.has(f)) score += 2
      // Breakfast and dinner don't stand in for each other.
      if (kin.has('breakfast') !== theirs.has('breakfast')) score -= 3
      if (Math.abs(r.activeMinutes - recipe.activeMinutes) <= 10) score += 0.3
      if (recipe.weather && recipe.weather !== 'any' && r.weather === recipe.weather) score += 0.3
      return { r, score }
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score || a.r.title.localeCompare(b.r.title))
    .slice(0, n)
    .map((x) => x.r)
}
