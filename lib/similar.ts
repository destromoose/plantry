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

/** Kitchens a dish leans toward, guessed from its title and ingredients. */
const families: [string, RegExp][] = [
  [
    'east-asian',
    /soy sauce|ginger|sesame|noodle|fried rice|stir-fry|teriyaki|hoisin|miso|bok choy/i,
  ],
  ['southeast-asian', /coconut milk|fish sauce|lemongrass|thai|curry paste|peanut/i],
  ['south-asian', /garam masala|curry powder|turmeric|lentil|dal|chickpea curry|naan|paneer/i],
  ['latin', /tortilla|taco|fajita|burrito|black bean|chipotle|quesadilla|salsa|enchilada/i],
  ['italian', /pasta|spaghetti|penne|parmesan|risotto|mozzarella|basil|gnocchi|carbonara/i],
  ['mediterranean', /feta|couscous|oregano|tzatziki|chickpea|shakshuka|olive|halloumi|za.?atar/i],
  ['breakfast', /pancake|oat|granola|waffle|french toast/i],
  ['soup', /soup|stew|chili|dal/i],
]

function familiesOf(r: Recipe): Set<string> {
  const text = [r.title, ...r.ingredients.flatMap((i) => [i.name, i.key])].join(' · ')
  return new Set(families.filter(([, re]) => re.test(text)).map(([f]) => f))
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
  return all
    .filter((r) => r.id !== recipe.id && isSafe(r, avoid))
    .map((r) => {
      let score = 0
      for (const k of keysOf.get(r.id) ?? []) if (mine.has(k)) score += weight(k)
      for (const x of r.tastes) if (tastes.has(x)) score += 0.75
      const theirs = familiesOf(r)
      for (const f of theirs) if (kin.has(f)) score += 2.5
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
