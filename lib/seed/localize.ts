import type { Recipe } from '@/lib/types'
import { getLang, type Lang } from '@/lib/i18n'
import { seedAdded, seedRecipes } from './recipes'
import { seedEs, type SeedText } from './recipes.es'

// The recipes that come with Plantry are shown in the phone's language. Saved data,
// exports and household sync always carry the English text, so two phones in
// different languages never see each other's copy as a change.

const english: Record<string, SeedText> = Object.fromEntries(
  seedRecipes.map((r) => [
    r.id,
    {
      title: r.title,
      description: r.description,
      ingredients: r.ingredients.map((i) => i.name),
      steps: r.steps.map((s) => s.text),
    },
  ])
)

function textFor(id: string, lang: Lang): SeedText | undefined {
  return lang === 'es' ? (seedEs[id] ?? english[id]) : english[id]
}

// Ids look like "<recipe>-i3" and "<recipe>-s2", so the position survives reordering.
const indexOf = (recipeId: string, id: string, tag: 'i' | 's') => {
  const m = id.match(new RegExp(`^${recipeId}-${tag}(\\d+)$`))
  return m ? Number(m[1]) - 1 : -1
}

function overlay(r: Recipe, text: SeedText | undefined): Recipe {
  if (!text) return r
  return {
    ...r,
    title: text.title,
    description: text.description,
    ingredients: r.ingredients.map((i) => {
      const name = text.ingredients[indexOf(r.id, i.id, 'i')]
      return name ? { ...i, name } : i
    }),
    steps: r.steps.map((s) => {
      const t = text.steps[indexOf(r.id, s.id, 's')]
      return t ? { ...s, text: t } : s
    }),
  }
}

/** A recipe that came with Plantry: its text can be swapped for a translation. */
const isSeed = (r: Recipe) => r.id in english && r.source === 'Plantry kitchen'

export function localizeRecipes(list: Recipe[], lang: Lang = getLang()): Recipe[] {
  return list.map((r) => (isSeed(r) ? overlay(r, textFor(r.id, lang)) : r))
}

export function canonicalRecipes(list: Recipe[]): Recipe[] {
  return localizeRecipes(list, 'en')
}

export const localSeedRecipes = () => localizeRecipes(seedRecipes)

/**
 * Starter recipes added since a kitchen was saved at `fromVersion`, minus any it
 * already has. Lets people who started earlier get new dinners without losing theirs.
 */
export function newSeedRecipes(fromVersion: number, have: Recipe[]): Recipe[] {
  const ids = new Set(have.map((r) => r.id))
  const added = new Set(
    Object.entries(seedAdded)
      .filter(([v]) => Number(v) > fromVersion)
      .flatMap(([, list]) => list)
  )
  return localizeRecipes(seedRecipes.filter((r) => added.has(r.id) && !ids.has(r.id)))
}
