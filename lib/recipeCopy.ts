import { t } from '@/lib/i18n'
import type { Recipe } from './types'
import { uid } from './utils'

/** A copy of a recipe that can be edited, leaving the original as it was. */
export function copyOfRecipe(
  r: Recipe
): Omit<Recipe, 'id' | 'createdAt' | 'isFavorite' | 'custom'> {
  const { id: _id, createdAt: _c, isFavorite: _f, custom: _x, ...rest } = r
  return {
    ...rest,
    title: t('{title} (my version)', { title: r.title }),
    ingredients: r.ingredients.map((i) => ({ ...i, id: uid('i') })),
    steps: r.steps.map((s) => ({ ...s, id: uid('s') })),
  }
}
