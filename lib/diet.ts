import { andList, t } from '@/lib/i18n'
import type { Ingredient, Member, Recipe, Settings } from './types'

// Allergens and diets. Recipes are checked from their ingredient names, so a recipe
// someone adds is covered too. This is a safety net, not a guarantee: always check
// packaging for allergens.

export type AvoidId =
  | 'peanut'
  | 'tree-nut'
  | 'dairy'
  | 'egg'
  | 'gluten'
  | 'soy'
  | 'sesame'
  | 'fish'
  | 'shellfish'
  | 'vegetarian'
  | 'vegan'
  | 'no-pork'
  | 'no-beef'
  | 'mild'

export const allergenOptions: { id: AvoidId; label: string }[] = [
  { id: 'peanut', label: t('Peanuts') },
  { id: 'tree-nut', label: t('Tree nuts') },
  { id: 'dairy', label: t('Dairy') },
  { id: 'egg', label: t('Eggs') },
  { id: 'gluten', label: t('Gluten') },
  { id: 'soy', label: t('Soy') },
  { id: 'sesame', label: t('Sesame') },
  { id: 'fish', label: t('Fish') },
  { id: 'shellfish', label: t('Shellfish') },
]

export const dietOptions: { id: AvoidId; label: string }[] = [
  { id: 'vegetarian', label: t('Vegetarian') },
  { id: 'vegan', label: t('Vegan') },
  { id: 'no-pork', label: t('No pork') },
  { id: 'no-beef', label: t('No beef') },
  { id: 'mild', label: t('Not spicy') },
]

export const avoidLabel = (id: string) =>
  [...allergenOptions, ...dietOptions].find((o) => o.id === id)?.label ?? id

type Tag =
  | 'peanut'
  | 'tree-nut'
  | 'dairy'
  | 'egg'
  | 'gluten'
  | 'soy'
  | 'sesame'
  | 'fish'
  | 'shellfish'
  | 'meat'
  | 'pork'
  | 'beef'
  | 'honey'

const words: Record<Tag, string[]> = {
  peanut: ['peanut', 'peanuts', 'peanut butter', 'satay'],
  'tree-nut': [
    'cashew',
    'almond',
    'walnut',
    'pecan',
    'pistachio',
    'hazelnut',
    'macadamia',
    'pine nut',
    'brazil nut',
    'nut',
    'nuts',
    'praline',
    'marzipan',
    'pesto',
  ],
  dairy: [
    'milk',
    'butter',
    'cheese',
    'cheddar',
    'feta',
    'parmesan',
    'mozzarella',
    'yogurt',
    'yoghurt',
    'cream',
    'ghee',
    'paneer',
    'ricotta',
    'halloumi',
    'mascarpone',
    'buttermilk',
    'creme fraiche',
    'pesto',
  ],
  egg: ['egg', 'eggs', 'mayonnaise', 'mayo', 'aioli'],
  gluten: [
    'bread',
    'pasta',
    'spaghetti',
    'penne',
    'noodle',
    'noodles',
    'tortilla',
    'flour',
    'soy sauce',
    'couscous',
    'barley',
    'wheat',
    'breadcrumb',
    'breadcrumbs',
    'panko',
    'pita',
    'naan',
    'bun',
    'buns',
    'toast',
    'teriyaki',
    'udon',
    'ramen',
    'lasagne',
    'lasagna',
    'gnocchi',
    'bulgur',
    'seitan',
  ],
  soy: ['soy', 'soy sauce', 'tofu', 'edamame', 'miso', 'tempeh', 'teriyaki'],
  sesame: ['sesame', 'sesame oil', 'tahini', 'hummus'],
  fish: [
    'fish',
    'salmon',
    'tuna',
    'cod',
    'anchovy',
    'anchovies',
    'sardine',
    'mackerel',
    'haddock',
    'trout',
    'fish sauce',
    'curry paste',
    'worcestershire',
  ],
  shellfish: [
    'prawn',
    'prawns',
    'shrimp',
    'crab',
    'lobster',
    'mussel',
    'mussels',
    'clam',
    'clams',
    'scallop',
    'scallops',
    'oyster',
    'squid',
    'calamari',
    'curry paste',
  ],
  meat: [
    'chicken',
    'beef',
    'pork',
    'lamb',
    'bacon',
    'ham',
    'sausage',
    'turkey',
    'mince',
    'prosciutto',
    'chorizo',
    'pancetta',
    'duck',
    'steak',
    'veal',
    'gelatin',
    'lard',
  ],
  pork: [
    'pork',
    'bacon',
    'ham',
    'prosciutto',
    'chorizo',
    'pancetta',
    'lard',
    'sausage',
    'salami',
    'pepperoni',
  ],
  beef: ['beef', 'steak', 'veal', 'brisket'],
  honey: ['honey'],
}

// Names that contain a word above but are fine.
const exceptions: Partial<Record<Tag, string[]>> = {
  dairy: [
    'peanut butter',
    'almond butter',
    'nut butter',
    'cocoa butter',
    'coconut milk',
    'coconut cream',
    'oat milk',
    'soy milk',
    'almond milk',
    'rice milk',
    'butter bean',
    'butter beans',
    'cream of tartar',
  ],
  'tree-nut': [
    'coconut',
    'nutmeg',
    'butternut',
    'peanut',
    'peanuts',
    'peanut butter',
    'pine nuts free',
    'doughnut',
    'donut',
  ],
  egg: ['eggplant', 'egg noodle-free'],
  gluten: [
    'rice noodle',
    'rice noodles',
    'corn tortilla',
    'corn tortillas',
    'gluten-free',
    'gluten free',
    'tamari',
  ],
  meat: ['chicken of the woods', 'vegetable stock', 'veggie sausage', 'vegan sausage'],
  pork: ['veggie sausage', 'vegan sausage'],
}

function has(text: string, tag: Tag) {
  let tItem = ` ${text} `
  for (const e of exceptions[tag] ?? []) tItem = tItem.split(e).join(' ')
  return words[tag].some((w) => new RegExp(`(^|[^a-z])${w}(s|es)?([^a-z]|$)`).test(tItem))
}

export function ingredientTags(i: Pick<Ingredient, 'name' | 'key'>): Set<Tag> {
  const text = `${i.name} ${i.key}`.toLowerCase()
  const out = new Set<Tag>()
  for (const tag of Object.keys(words) as Tag[]) if (has(text, tag)) out.add(tag)
  // Meat stock is meat; a plain "stock" is left to the cook.
  if (/(chicken|beef|pork|lamb|fish) stock/.test(text)) out.add('meat')
  return out
}

/** Which ingredient tags break this rule. */
function blockedBy(rule: string): Tag[] {
  switch (rule) {
    case 'vegetarian':
      return ['meat', 'fish', 'shellfish']
    case 'vegan':
      return ['meat', 'fish', 'shellfish', 'dairy', 'egg', 'honey']
    case 'no-pork':
      return ['pork']
    case 'no-beef':
      return ['beef']
    case 'mild':
      return []
    default:
      return [rule as Tag]
  }
}

export interface Conflict {
  /** Rules this recipe breaks even after leaving out optional ingredients. */
  blocking: string[]
  /** Optional ingredients to leave out to stay safe. */
  leaveOut: string[]
  /** Required ingredient names that break a rule. */
  culprits: string[]
}

export function conflicts(
  recipe: Pick<Recipe, 'ingredients'> & { tastes?: Recipe['tastes'] },
  avoid: string[]
): Conflict {
  const blocking = new Set<string>()
  const leaveOut = new Set<string>()
  const culprits = new Set<string>()
  if (!avoid.length) return { blocking: [], leaveOut: [], culprits: [] }
  if (avoid.includes('mild') && recipe.tastes?.includes('spicy')) {
    blocking.add('mild')
    culprits.add(t('chili heat'))
  }
  for (const ing of recipe.ingredients) {
    const tags = ingredientTags(ing)
    for (const rule of avoid) {
      if (!blockedBy(rule).some((tItem) => tags.has(tItem))) continue
      if (ing.optional) leaveOut.add(ing.name)
      else {
        blocking.add(rule)
        culprits.add(ing.name)
      }
    }
  }
  return { blocking: [...blocking], leaveOut: [...leaveOut], culprits: [...culprits] }
}

export const isSafe = (
  recipe: Pick<Recipe, 'ingredients'> & { tastes?: Recipe['tastes'] },
  avoid: string[]
) => conflicts(recipe, avoid).blocking.length === 0

/** Everything the household avoids: the shared list plus every person's. */
export function householdAvoid(settings: Pick<Settings, 'avoid'>, members: Member[]): string[] {
  const all = new Set<string>(settings.avoid ?? [])
  for (const m of members) {
    for (const a of m.avoid ?? []) all.add(a)
    if (m.diet) all.add(m.diet)
  }
  return [...all]
}

/** A short warning like "Has peanuts and dairy". */
export function conflictText(c: Conflict) {
  if (!c.blocking.length) return ''
  const isDiet = (b: string) => dietOptions.some((d) => d.id === b)
  const allergens = c.blocking.filter((b) => !isDiet(b)).map((b) => avoidLabel(b).toLowerCase())
  const parts: string[] = []
  if (allergens.length) parts.push(t('Has {v0}', { v0: andList(allergens) }))
  for (const d of c.blocking.filter(isDiet))
    parts.push(d === 'mild' ? t('Spicy') : t('Not {v0}', { v0: avoidLabel(d).toLowerCase() }))
  return parts.join(' · ')
}
