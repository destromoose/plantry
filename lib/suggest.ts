import type { Context, Energy, PantryItem, Recipe, Taste } from './types'
import { isSafe } from './diet'
import { isUseSoon, toDateKey } from './utils'

export interface Scored {
  recipe: Recipe
  score: number
  have: number
  missing: string[]
  reasons: string[]
}

export interface SuggestInput {
  recipes: Recipe[]
  pantry: PantryItem[]
  tastes: Taste[]
  energy?: Energy
  context: Pick<Context, 'weatherLean' | 'isWeekend' | 'now'>
  /** Recipe ids cooked recently, most recent first. Penalized so dinner does not repeat. */
  recent?: string[]
  exclude?: string[]
  /** Allergens and diets to respect. Recipes that break one are never suggested. */
  avoid?: string[]
}

/** Coverage of a recipe's required ingredients by the pantry. */
export function coverage(recipe: Recipe, pantry: PantryItem[]) {
  const keys = new Set(pantry.map((p) => p.key))
  const required = recipe.ingredients.filter((i) => !i.optional)
  const missing = required.filter((i) => !keys.has(i.key)).map((i) => i.name)
  return { have: required.length - missing.length, total: required.length, missing }
}

/**
 * The suggestion ranker. Pure and deterministic given its inputs, so a model
 * can later replace it behind the same interface.
 */
export function suggest(input: SuggestInput): Scored[] {
  const { recipes, pantry, tastes, energy, context, recent = [], exclude = [], avoid = [] } = input
  const today = toDateKey(new Date(context.now))
  const aging = new Set(pantry.filter((p) => isUseSoon(p, today)).map((p) => p.key))

  const out: Scored[] = []
  for (const recipe of recipes) {
    if (exclude.includes(recipe.id)) continue
    if (avoid.length && !isSafe(recipe, avoid)) continue
    const reasons: string[] = []
    let score = 0

    const cov = coverage(recipe, pantry)
    const ratio = cov.total ? cov.have / cov.total : 0
    score += ratio * 40
    if (cov.missing.length === 0 && cov.total > 0) reasons.push('You have everything')
    else if (cov.missing.length <= 2 && cov.total > 0)
      reasons.push(`Only missing ${cov.missing.join(' and ')}`)

    const usesAging = recipe.ingredients.filter((i) => aging.has(i.key))
    if (usesAging.length) {
      score += Math.min(usesAging.length, 3) * 6
      reasons.push(`Uses up your ${usesAging[0].name.toLowerCase()}`)
    }

    const tasteHits = recipe.tastes.filter((t) => tastes.includes(t)).length
    score += tasteHits * 5

    if (energy === 'quick') {
      if (recipe.activeMinutes <= 20) {
        score += 15
        reasons.push('Quick')
      } else score -= recipe.activeMinutes
    } else if (energy === 'cant-tonight') {
      if (recipe.activeMinutes <= 10) score += 25
      else score -= 100
    } else if (energy === 'up-for-it') {
      if (recipe.totalMinutes >= 40) score += 4
    } else {
      score += recipe.activeMinutes <= 30 ? 4 : 0
    }

    if (context.weatherLean !== 'any' && recipe.weather === context.weatherLean) {
      score += 10
      reasons.push(context.weatherLean === 'warm' ? 'Good for a cold night' : 'Nothing heavy')
    }
    if (
      context.weatherLean !== 'any' &&
      recipe.weather &&
      recipe.weather !== 'any' &&
      recipe.weather !== context.weatherLean
    )
      score -= 6

    if (!context.isWeekend && recipe.totalMinutes > 60) score -= 8
    if (context.isWeekend && recipe.tastes.includes('big-batch')) score += 4

    const recentIdx = recent.indexOf(recipe.id)
    if (recentIdx !== -1) score -= Math.max(0, 25 - recentIdx * 5)

    if (recipe.isFavorite) score += 3

    out.push({ recipe, score, have: cov.have, missing: cov.missing, reasons: reasons.slice(0, 2) })
  }
  return out.sort((a, b) => b.score - a.score)
}

/** Deterministic pseudo-random pick weighted toward the top so the shuffle feels fair but surprising. */
export function pickNext(ranked: Scored[], seenIds: string[]): Scored | undefined {
  const fresh = ranked.filter((s) => !seenIds.includes(s.recipe.id))
  if (fresh.length === 0) return ranked[0]
  const pool = fresh.slice(0, 5)
  const weights = pool.map((_, i) => 5 - i)
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]
    if (r <= 0) return pool[i]
  }
  return pool[0]
}
