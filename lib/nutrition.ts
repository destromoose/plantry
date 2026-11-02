// Rough nutrition per serving, from the ingredient facts table.

import type { Recipe } from './types'
import { factsFor, gramsOf } from './ingredientFacts'

export interface Nutrition {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fibre: number
  /** Required ingredients we could count. */
  known: number
  /** All required ingredients. */
  total: number
}

/** Per serving, for the recipe as written. Optional ingredients are left out. */
export function nutritionOf(recipe: Recipe): Nutrition {
  const out: Nutrition = { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, known: 0, total: 0 }
  for (const ing of recipe.ingredients) {
    if (ing.optional) continue
    out.total++
    const f = factsFor(ing)
    const g = f && gramsOf(ing.quantity, ing.unit, f)
    if (!f || g === undefined) continue
    out.known++
    const k = g / 100
    out.kcal += f.kcal * k
    out.protein += f.protein * k
    out.carbs += f.carbs * k
    out.fat += f.fat * k
    out.fibre += f.fibre * k
  }
  const per = Math.max(1, recipe.servings)
  for (const key of ['kcal', 'protein', 'carbs', 'fat', 'fibre'] as const) out[key] /= per
  return out
}

/** Trust the numbers only when most of the dinner was counted. */
export const isReliable = (n: Nutrition) => n.total > 0 && n.known / n.total >= 0.75
